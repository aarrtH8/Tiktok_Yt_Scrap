#!/usr/bin/env python3
"""
Backend Server for YouTube to TikTok Video Compiler
Handles video downloading, processing, and compilation
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import json
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path
from threading import Thread
from typing import Optional, Dict, Any

# Import custom modules
from video_processor import VideoProcessor
from youtube_downloader import YouTubeDownloader
from moment_detector import MomentDetector

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
TEMP_DIR = Path("/tmp/video-compiler")
TEMP_DIR.mkdir(exist_ok=True)
SESSIONS_DIR = TEMP_DIR / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)

# Session storage (in production, use Redis or database)
sessions = {}

# Initialize processors
video_processor = VideoProcessor(TEMP_DIR)
youtube_downloader = YouTubeDownloader(TEMP_DIR)
moment_detector = MomentDetector()


def cleanup_old_sessions():
    """Clean up sessions older than 1 hour"""
    try:
        cutoff_time = datetime.now() - timedelta(hours=1)
        expired_sessions = [
            sid for sid, data in sessions.items()
            if datetime.fromisoformat(data.get('created_at', '2000-01-01')) < cutoff_time
        ]
        
        for session_id in expired_sessions:
            session_data = sessions.pop(session_id, None)
            if session_data and 'files' in session_data:
                for file_path in session_data['files']:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                    except Exception as e:
                        logger.error(f"Error cleaning up file {file_path}: {e}")
        
        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
    except Exception as e:
        logger.error(f"Error in cleanup: {e}")


def _calc_eta(start_time: Optional[datetime], percent: float) -> Optional[int]:
    if not start_time or percent <= 0 or percent >= 100:
        return None
    elapsed = (datetime.now() - start_time).total_seconds()
    try:
        remaining = elapsed * ((100 - percent) / percent)
        return int(max(1, remaining))
    except ZeroDivisionError:
        return None


def _init_session(videos, settings):
    session_id = str(uuid.uuid4())
    session_data = {
        'id': session_id,
        'created_at': datetime.now().isoformat(),
        'videos': videos,
        'settings': settings,
        'downloaded_files': [],
        'moments': [],
        'status': 'processing',
        'progress': 0,
        'stage': 'Initialisation',
        'error': None,
        'started_at': datetime.now().isoformat(),
        'tasks': [
            {'id': 'download', 'label': 'Téléchargement des vidéos', 'status': 'pending', 'progress': 0, 'detail': '', 'etaSeconds': None},
            {'id': 'analyze', 'label': 'Détection des meilleurs moments', 'status': 'pending', 'progress': 0, 'detail': '', 'etaSeconds': None},
            {'id': 'compile', 'label': 'Compilation / Export', 'status': 'pending', 'progress': 0, 'detail': 'En attente du lancement du téléchargement', 'etaSeconds': None},
        ]
    }
    sessions[session_id] = session_data
    return session_id, session_data


def _update_task(session_id: str, task_id: str, status: Optional[str] = None, progress: Optional[float] = None,
                 detail: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
    session = sessions.get(session_id)
    if not session:
        return
    for task in session['tasks']:
        if task['id'] == task_id:
            if status:
                task['status'] = status
            if progress is not None:
                task['progress'] = max(0, min(100, progress))
            if detail is not None:
                task['detail'] = detail
            if extra:
                task.update(extra)
            break
    # Recompute overall progress and ETA
    progresses = []
    for task in session['tasks']:
        if 'progress' in task:
            progresses.append(task['progress'])
        else:
            progresses.append(0 if task.get('status') == 'pending' else 100)
    if progresses:
        session['progress'] = round(sum(progresses) / len(progresses))
        session['etaTotalSeconds'] = _calc_eta(
            datetime.fromisoformat(session['started_at']) if session.get('started_at') else None,
            session['progress']
        )
    sessions[session_id] = session


def _set_stage(session_id: str, stage: str):
    session = sessions.get(session_id)
    if not session:
        return
    session['stage'] = stage
    sessions[session_id] = session


def _run_processing(session_id, videos, settings, output_duration, auto_detect):
    """Background processing to keep the API responsive and allow progress polling."""
    try:
        session = sessions.get(session_id)
        if not session:
            return

        total_steps = len(videos) * 2  # download + analyze per video
        completed_steps = 0

        # Download videos
        _set_stage(session_id, 'Téléchargement des vidéos')
        _update_task(session_id, 'download', status='in_progress', progress=0, detail='0 Mo / ? Mo')
        download_start = datetime.now()
        downloaded_totals = [0] * len(videos)
        total_bytes_list = [None] * len(videos)
        downloaded_files = []
        for idx, video in enumerate(videos):
            video_id = video['id']
            video_url = video['url']
            logger.info(f"Downloading video {idx + 1}/{len(videos)}: {video['title']}")

            def progress_cb(downloaded, total):
                downloaded_totals[idx] = downloaded or 0
                if total:
                    total_bytes_list[idx] = total
                total_downloaded = sum(downloaded_totals)
                total_expected = sum([t for t in total_bytes_list if t]) or None
                if total_expected:
                    pct = min(99.0, (total_downloaded / total_expected) * 100)
                    detail = f"{total_downloaded/1_000_000:.1f} Mo / {total_expected/1_000_000:.1f} Mo"
                else:
                    pct = min(99.0, (downloaded / (total or 1)) * 100)
                    detail = f"{total_downloaded/1_000_000:.1f} Mo téléchargés"
                eta = _calc_eta(download_start, pct)
                _update_task(session_id, 'download', progress=pct, detail=detail, extra={'etaSeconds': eta})

            video_path = youtube_downloader.download_video(video_url, session_id, video_id, progress_callback=progress_cb)
            downloaded_files.append(video_path)
            completed_steps += 1
            detail = f"{idx + 1}/{len(videos)} vidéos téléchargées"
            pct_download = min(100, (completed_steps / total_steps) * 100)
            _update_task(session_id, 'download', progress=pct_download, detail=detail, extra={'etaSeconds': _calc_eta(download_start, pct_download)})

        _update_task(session_id, 'download', status='done', progress=100, detail='Téléchargement terminé', extra={'etaSeconds': 0})
        _set_stage(session_id, 'Analyse des moments')
        _update_task(session_id, 'analyze', status='in_progress', progress=0, detail='Démarrage de l’analyse')
        analyze_start = datetime.now()

        # Detect moments
        all_moments = []
        for idx, video in enumerate(videos):
            try:
                video_id = video['id']
                logger.info(f"Analyzing video {idx + 1}/{len(videos)}: {video['title']}")
                scene_times = moment_detector.detect_scene_changes(downloaded_files[idx])
                scene_count = len(scene_times)
                if auto_detect:
                    moments = moment_detector.detect_moments(
                        downloaded_files[idx],
                        video['duration'],
                        output_duration // len(videos),
                        video['title'],
                        scene_times
                    )
                else:
                    moments = moment_detector.distribute_moments(
                        video['duration'],
                        output_duration // len(videos),
                        video['title']
                    )

                for moment in moments:
                    moment['videoId'] = video_id
                    moment['videoIndex'] = idx
                    moment['videoTitle'] = video['title']

                all_moments.extend(moments)
                completed_steps += 1
                target_clip_count = int(output_duration / 7.0)
                selected_so_far = min(len(all_moments), target_clip_count)
                detail = f"Scènes: {scene_count} | Clips trouvés: {len(all_moments)} | Sélection: {selected_so_far}/{target_clip_count}"
                pct_analyze = ((completed_steps) / total_steps) * 100
                task_progress = min(100, (idx + 1) / len(videos) * 100)
                _update_task(
                    session_id,
                    'analyze',
                    progress=task_progress,
                    detail=detail,
                    extra={'etaSeconds': _calc_eta(analyze_start, task_progress)}
                )
            except Exception as e:
                logger.error(f"Error processing video {video['title']}: {e}")
                continue

        _update_task(session_id, 'analyze', status='done', progress=100, detail='Analyse terminée', extra={'etaSeconds': 0})
        _set_stage(session_id, 'Prêt pour compilation')
        _update_task(session_id, 'compile', status='pending', progress=0, detail='Clique sur Télécharger pour lancer la compilation', extra={'etaSeconds': None})

        # Sort and select moments
        clip_duration = 7.0
        target_clip_count = int(output_duration / clip_duration)
        top_moments = sorted(all_moments, key=lambda x: x['score'], reverse=True)[:target_clip_count]
        top_moments = sorted(top_moments, key=lambda x: (x['videoIndex'], x['start']))

        sessions[session_id]['downloaded_files'] = downloaded_files
        sessions[session_id]['moments'] = top_moments
        sessions[session_id]['status'] = 'ready'
        sessions[session_id]['stage'] = 'Prêt pour compilation'
        sessions[session_id]['videoCount'] = len(videos)
        sessions[session_id]['clipCount'] = len(top_moments)
        sessions[session_id]['totalDuration'] = output_duration
        sessions[session_id]['etaTotalSeconds'] = 0

        logger.info(f"Session {session_id} ready with {len(top_moments)} moments")
    except Exception as e:
        logger.error(f"Error in background processing: {e}", exc_info=True)
        session = sessions.get(session_id)
        if session:
            session['status'] = 'error'
            session['error'] = str(e)
            session['stage'] = 'Erreur'
            session['progress'] = 0
            sessions[session_id] = session


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'ffmpeg': video_processor.check_ffmpeg(),
            'yt-dlp': youtube_downloader.check_ytdlp()
        }
    })


@app.route('/api/detect-video', methods=['POST'])
def detect_videos():
    """
    Detect and fetch metadata for YouTube videos
    Expects: { "urls": ["youtube_url1", "youtube_url2", ...] }
    Returns: { "videos": [{id, title, duration, thumbnail, ...}] }
    """
    try:
        data = request.get_json()
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'error': 'No URLs provided'}), 400
        
        logger.info(f"Detecting {len(urls)} videos")
        
        videos = []
        for url in urls:
            try:
                metadata = youtube_downloader.get_video_metadata(url)
                videos.append({
                    'id': metadata['id'],
                    'url': url,
                    'title': metadata['title'],
                    'duration': metadata['duration'],
                    'durationFormatted': metadata['duration_formatted'],
                    'channel': metadata['channel'],
                    'thumbnail': metadata['thumbnail'],
                })
                logger.info(f"Successfully detected: {metadata['title']}")
            except Exception as e:
                logger.error(f"Error detecting video {url}: {e}")
                videos.append({
                    'id': str(uuid.uuid4()),
                    'url': url,
                    'title': 'Error loading video',
                    'duration': 0,
                    'durationFormatted': '0:00',
                    'channel': 'Unknown',
                    'thumbnail': '',
                    'error': str(e)
                })
        
        return jsonify({'videos': videos})
    
    except Exception as e:
        logger.error(f"Error in detect_videos: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/process-video', methods=['POST'])
def process_videos():
    """
    Process videos and detect best moments
    Expects: { "videos": [...], "settings": {duration, quality, ...} }
    Returns: { "sessionId": "...", "moments": [...] }
    """
    try:
        cleanup_old_sessions()
        
        data = request.get_json()
        videos = data.get('videos', [])
        settings = data.get('settings', {})
        
        if not videos:
            return jsonify({'error': 'No videos provided'}), 400
        
        output_duration = int(settings.get('duration', 30))
        quality = settings.get('quality', '720p')
        auto_detect = settings.get('autoDetect', True)
        
        logger.info(f"Processing {len(videos)} videos for {output_duration}s compilation")
        
        session_id, _ = _init_session(videos, settings)

        processing_thread = Thread(
            target=_run_processing,
            args=(session_id, videos, settings, output_duration, auto_detect),
            daemon=True
        )
        processing_thread.start()

        return jsonify({'success': True, 'sessionId': session_id, 'status': 'processing'})
    
    except Exception as e:
        logger.error(f"Error in process_videos: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/progress/<session_id>', methods=['GET'])
def get_progress(session_id):
    """Return processing progress for a given session"""
    session = sessions.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found or expired'}), 404

    response = {
        'status': session.get('status'),
        'progress': session.get('progress', 0),
        'stage': session.get('stage', 'En cours'),
        'tasks': session.get('tasks', []),
        'error': session.get('error'),
        'etaTotalSeconds': session.get('etaTotalSeconds')
    }

    if session.get('status') == 'ready':
        moments_preview = [
            {
                'order': idx + 1,
                'timestamp': moment['timestamp'],
                'duration': moment['duration'],
                'title': moment['title'],
                'score': moment['score'],
                'engagementLevel': moment.get('engagementLevel', 'Medium'),
                'videoTitle': moment['videoTitle']
            }
            for idx, moment in enumerate(session.get('moments', []))
        ]

        response.update({
            'moments': moments_preview,
            'videoCount': session.get('videoCount', len(session.get('videos', []))),
            'clipCount': session.get('clipCount'),
            'totalDuration': session.get('totalDuration')
        })

    return jsonify(response)


@app.route('/api/download-video', methods=['POST'])
def download_video():
    """
    Compile and download the final TikTok video
    Expects: { "sessionId": "...", "quality": "720p" }
    Returns: MP4 video file
    """
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        quality = data.get('quality', '720p')
        
        if not session_id:
            return jsonify({'error': 'No session ID provided'}), 400
        
        session_data = sessions.get(session_id)
        if not session_data:
            return jsonify({'error': 'Session not found or expired'}), 404
        
        if session_data['status'] != 'ready':
            return jsonify({'error': 'Session not ready'}), 400
        
        logger.info(f"Compiling video for session {session_id}")
        _set_stage(session_id, 'Compilation en cours')
        _update_task(session_id, 'compile', status='in_progress', progress=5, detail='Préparation des clips')
        
        moments = session_data['moments']
        downloaded_files = session_data['downloaded_files']
        
        # Create clips data for compilation
        clips = []
        for moment in moments:
            video_index = moment['videoIndex']
            if video_index < len(downloaded_files):
                clips.append({
                    'file_path': downloaded_files[video_index],
                    'start': moment['start'],
                    'end': moment['end']
                })
        
        # Compile video in TikTok format (9:16)
        output_path = TEMP_DIR / f"compilation_{session_id}.mp4"
        
        logger.info(f"Compiling {len(clips)} clips into TikTok format...")
        _update_task(session_id, 'compile', status='in_progress', progress=40, detail='Encodage en cours')
        video_processor.compile_tiktok_video(
            clips,
            str(output_path),
            quality
        )
        
        logger.info(f"Video compilation complete: {output_path}")
        _update_task(session_id, 'compile', status='done', progress=100, detail='Compilation terminée', extra={'etaSeconds': 0})
        _set_stage(session_id, 'Compilation terminée')
        
        # Send file and cleanup
        response = send_file(
            output_path,
            mimetype='video/mp4',
            as_attachment=True,
            download_name='tiktok-compilation.mp4'
        )
        
        # Schedule cleanup
        @response.call_on_close
        def cleanup():
            try:
                # Clean up downloaded files
                for file_path in downloaded_files:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                
                # Clean up output file
                if os.path.exists(output_path):
                    os.remove(output_path)
                
                # Remove session
                sessions.pop(session_id, None)
                
                logger.info(f"Cleaned up session {session_id}")
            except Exception as e:
                logger.error(f"Error in cleanup: {e}")
        
        return response
    
    except Exception as e:
        logger.error(f"Error in download_video: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session and clean up files"""
    try:
        session_data = sessions.pop(session_id, None)
        
        if not session_data:
            return jsonify({'error': 'Session not found'}), 404
        
        # Clean up files
        for file_path in session_data.get('downloaded_files', []):
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.error(f"Error removing file {file_path}: {e}")
        
        return jsonify({'success': True})
    
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info("Starting YouTube to TikTok Compiler Backend")
    logger.info(f"Temp directory: {TEMP_DIR}")
    logger.info(f"FFmpeg available: {video_processor.check_ffmpeg()}")
    logger.info(f"yt-dlp available: {youtube_downloader.check_ytdlp()}")
    
    # Run server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
