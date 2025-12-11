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
import tempfile
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from threading import Thread
from typing import Optional, Dict, Any
import re

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

# Configuration helpers
def create_temp_root():
    """Ensure we have a writable temp directory even if /tmp is not usable"""
    candidates = []
    env_override = os.environ.get('VIDEO_COMPILER_TEMP')
    if env_override:
        candidates.append(Path(env_override))
    candidates.append(Path(tempfile.gettempdir()) / "video-compiler")
    # fallback inside project directory
    project_tmp = Path(__file__).resolve().parent / "_video_temp"
    candidates.append(project_tmp)

    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            test_file = candidate / f".perm_{os.getpid()}"
            with open(test_file, 'w') as f:
                f.write('ok')
            test_file.unlink(missing_ok=True)
            logger.info(f"Using temp directory: {candidate}")
            return candidate
        except Exception as e:
            logger.warning(f"Temp dir {candidate} not usable: {e}")
            continue
    raise RuntimeError("Unable to create writable temp directory for video compilation")


TEMP_DIR = create_temp_root()
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


def probe_video_duration(file_path):
    """Return duration in seconds using ffprobe"""
    if not file_path or not os.path.exists(file_path):
        return None
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15
        )
        if result.returncode != 0:
            return None
        duration = float(result.stdout.strip())
        return duration if duration > 0 else None
    except Exception as exc:
        logger.warning(f"Unable to probe duration for {file_path}: {exc}")
        return None


def clamp_moments_to_duration(moments, target_seconds):
    """Ensure the total duration of selected moments stays close to the requested target."""
    if not moments or target_seconds <= 0:
        return moments

    allowed_overrun = max(4.0, target_seconds * 0.12)
    hard_limit = target_seconds + allowed_overrun
    total = 0.0
    limited = []

    for moment in moments:
        start = float(moment.get('start', 0.0))
        end = float(moment.get('end', start))
        duration = max(1.0, end - start)

        if total >= hard_limit:
            break

        remaining_to_target = max(target_seconds - total, 0.0)
        if total + duration <= hard_limit and (remaining_to_target - duration) >= -allowed_overrun:
            limited.append(moment)
            total += duration
            if total >= target_seconds:
                break
        else:
            remaining = max(remaining_to_target, 0.0)
            if remaining <= 0.5:
                break
            clipped_end = start + remaining
            trimmed = moment.copy()
            trimmed['end'] = clipped_end
            trimmed['duration'] = f"{max(1, int(round(clipped_end - start)))}s"
            limited.append(trimmed)
            total += remaining
            break

    if not limited and moments:
        first = moments[0]
        start = float(first.get('start', 0.0))
        end = float(first.get('end', start))
        duration = max(1.0, min(target_seconds, end - start))
        trimmed = first.copy()
        trimmed['end'] = start + duration
        trimmed['duration'] = f"{max(1, int(round(duration)))}s"
        limited.append(trimmed)

    return limited


def slugify_hashtag(text: str) -> Optional[str]:
    if not text:
        return None
    cleaned = re.sub(r'[^a-z0-9]+', '', text.lower())
    if not cleaned:
        return None
    return f"#{cleaned[:24]}"


def generate_tiktok_caption(videos, moments, target_duration):
    video_titles = [v.get('title', '') for v in videos if v.get('title')]
    moment_titles = [m.get('title', '') for m in moments if m.get('title')]
    main_title = video_titles[0] if video_titles else "Compilation TikTok"
    duration_line = f"{int(target_duration)}s de punchlines." if target_duration else "Moments forts compressés."
    moment_line = ""
    if moment_titles:
        moment_line = "Moments: " + ", ".join(moment_titles[:3])

    hashtags = ['#tiktok', '#shorts', '#reels']
    derived_tags = []
    for source in video_titles[:2] + moment_titles[:2]:
        tag = slugify_hashtag(source)
        if tag and tag not in derived_tags:
            derived_tags.append(tag)
    hashtags.extend(derived_tags)

    caption_parts = [
        f"{main_title} — {duration_line}",
    ]
    if moment_line:
        caption_parts.append(moment_line)
    caption_parts.append(" ".join(hashtags))
    return "\n\n".join(caption_parts)


def _calc_eta(start_time: datetime, percent: float) -> Optional[int]:
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
        'subtitle_files': [],
        'video_durations': [],
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
        ],
        'etaTotalSeconds': None,
    }
    sessions[session_id] = session_data
    return session_id, session_data


def _update_task(session_id: str, task_id: str, status: Optional[str] = None, progress: Optional[float] = None,
                 detail: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
    session = sessions.get(session_id)
    if not session:
        return
    for task in session.get('tasks', []):
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
    progresses = [task.get('progress', 0 if task.get('status') == 'pending' else 100) for task in session.get('tasks', [])]
    if progresses:
        session['progress'] = round(sum(progresses) / len(progresses))
        started_at = datetime.fromisoformat(session['started_at']) if session.get('started_at') else datetime.now()
        session['etaTotalSeconds'] = _calc_eta(started_at, session['progress'])
    sessions[session_id] = session


def _set_stage(session_id: str, stage: str):
    session = sessions.get(session_id)
    if not session:
        return
    session['stage'] = stage
    sessions[session_id] = session


def _run_processing(session_id, videos, settings, output_duration, auto_detect, include_subtitles):
    """Background processing to keep the API responsive and allow progress polling."""
    try:
        session = sessions.get(session_id)
        if not session:
            return

        downloaded_files = [None] * len(videos)
        subtitle_files = [None] * len(videos)
        video_durations = [0.0] * len(videos)
        processed_indexes = []
        all_moments = []

        sessions[session_id]['downloaded_files'] = downloaded_files
        sessions[session_id]['subtitle_files'] = subtitle_files
        sessions[session_id]['video_durations'] = video_durations

        _set_stage(session_id, 'Téléchargement des vidéos')
        _update_task(session_id, 'download', status='in_progress', detail='Préparation des téléchargements')
        download_start = datetime.now()
        downloaded_totals = [0] * len(videos)
        total_bytes_list: list[Optional[int]] = [None] * len(videos)

        for idx, video in enumerate(videos):
            try:
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
                        pct = min(99.0, (downloaded or 0) / ((total or 1)) * 100)
                        detail = f"{total_downloaded/1_000_000:.1f} Mo téléchargés"
                    eta = _calc_eta(download_start, pct)
                    _update_task(session_id, 'download', progress=pct, detail=detail, extra={'etaSeconds': eta})

                video_path, subtitle_path = youtube_downloader.download_video(
                    video_url,
                    session_id,
                    video_id,
                    download_subtitles=include_subtitles,
                    progress_callback=progress_cb
                )
                downloaded_files[idx] = video_path
                subtitle_files[idx] = subtitle_path
                processed_indexes.append(idx)
                actual_duration = (
                    probe_video_duration(video_path)
                    or float(video.get('duration') or 0)
                )
                if not actual_duration or actual_duration <= 0:
                    actual_duration = 30.0
                video_durations[idx] = actual_duration
            except Exception as exc:
                logger.error(f"Error downloading video {video.get('title', idx)}: {exc}")
                continue

        _update_task(session_id, 'download', status='done', progress=100, detail='Téléchargement terminé', extra={'etaSeconds': 0})

        _set_stage(session_id, 'Analyse des moments')
        _update_task(session_id, 'analyze', status='in_progress', detail='Analyse en cours')
        analyze_start = datetime.now()

        for idx, video in enumerate(videos):
            video_path = downloaded_files[idx]
            if not video_path:
                continue
            try:
                logger.info(f"Analyzing video {idx + 1}/{len(videos)}: {video['title']}")
                scene_times = moment_detector.detect_scene_changes(video_path)
                if auto_detect:
                    moments = moment_detector.detect_moments(
                        video_path,
                        video_durations[idx],
                        output_duration // len(videos),
                        video['title'],
                        scene_times
                    )
                else:
                    moments = moment_detector.distribute_moments(
                        video_durations[idx],
                        output_duration // len(videos),
                        video['title']
                    )

                for moment in moments:
                    moment['videoId'] = video['id']
                    moment['videoIndex'] = idx
                    moment['videoTitle'] = video['title']

                all_moments.extend(moments)

                progress = ((idx + 1) / max(1, len(videos))) * 100
                detail = f"{len(moments)} clips détectés sur {video['title']}"
                _update_task(
                    session_id,
                    'analyze',
                    progress=progress,
                    detail=detail,
                    extra={'etaSeconds': _calc_eta(analyze_start, progress)}
                )
            except Exception as exc:
                logger.error(f"Error processing video {video['title']}: {exc}")
                continue

        _update_task(session_id, 'analyze', status='done', progress=100, detail='Analyse terminée', extra={'etaSeconds': 0})

        clip_duration = 4.5
        target_clip_count = max(1, int(output_duration / clip_duration))
        top_moments = sorted(
            all_moments,
            key=lambda x: (-x['score'], x.get('start', 0.0))
        )[:target_clip_count]

        if not top_moments and processed_indexes:
            logger.warning("No moments detected; generating fallback clips from raw videos.")
            fallback_count = len(processed_indexes)
            slice_duration = max(6, int(output_duration / max(1, fallback_count)))
            fallback_moments = []
            for idx in processed_indexes:
                video = videos[idx]
                video_title = video.get('title', f'Clip {idx + 1}')
                video_duration = max(video_durations[idx], slice_duration)
                end_time = min(video_duration, slice_duration)
                if end_time <= 0:
                    continue
                fallback_moments.append({
                    'start': 0.0,
                    'end': end_time,
                    'timestamp': "0:00",
                    'duration': f"{int(end_time)}s",
                    'title': f"Extrait principal · {video_title}",
                    'score': 0.6,
                    'engagementLevel': 'Medium',
                    'videoId': video.get('id', ''),
                    'videoIndex': idx,
                    'videoTitle': video_title
                })
            top_moments = fallback_moments
        if not top_moments:
            raise RuntimeError("Unable to detect or generate any clips for this session.")

        target_seconds = max(10.0, float(output_duration))
        top_moments = clamp_moments_to_duration(top_moments, target_seconds)

        session_data = sessions.get(session_id, {})
        session_data['downloaded_files'] = downloaded_files
        session_data['moments'] = top_moments
        session_data['status'] = 'ready'
        session_data['subtitle_files'] = subtitle_files
        session_data['video_durations'] = video_durations
        session_data['videoCount'] = len(videos)
        session_data['clipCount'] = len(top_moments)
        session_data['totalDuration'] = output_duration
        session_data['stage'] = 'Prêt pour compilation'
        session_data['etaTotalSeconds'] = 0
        session_data['tiktok_caption'] = generate_tiktok_caption(videos, top_moments, output_duration)
        sessions[session_id] = session_data
        _update_task(session_id, 'compile', detail='Clique sur Télécharger pour lancer la compilation')

        logger.info(f"Session {session_id} ready with {len(top_moments)} moments")
    except Exception as exc:
        logger.error(f"Error in background processing: {exc}", exc_info=True)
        session = sessions.get(session_id)
        if session:
            session['status'] = 'error'
            session['error'] = str(exc)
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
        include_subtitles = settings.get('includeSubtitles', True)
        
        logger.info(f"Processing {len(videos)} videos for {output_duration}s compilation")

        session_id, _ = _init_session(videos, settings)

        processing_thread = Thread(
            target=_run_processing,
            args=(session_id, videos, settings, output_duration, auto_detect, include_subtitles),
            daemon=True
        )
        processing_thread.start()

        return jsonify({
            'success': True,
            'sessionId': session_id,
            'status': 'processing'
        })
    
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
        'etaTotalSeconds': session.get('etaTotalSeconds'),
        'tiktokCaption': session.get('tiktok_caption'),
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
            'totalDuration': session.get('totalDuration'),
            'tiktokCaption': session.get('tiktok_caption'),
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
        _update_task(session_id, 'compile', status='in_progress', progress=10, detail='Préparation des clips')
        
        moments = session_data['moments']
        downloaded_files = session_data['downloaded_files']
        subtitle_files = session_data.get('subtitle_files', [])
        video_durations = session_data.get('video_durations', [])
        
        # Create clips data for compilation
        clips = []
        for moment in moments:
            video_index = moment['videoIndex']
            if video_index < len(downloaded_files):
                file_path = downloaded_files[video_index]
                if not file_path:
                    continue
                duration_hint = (
                    video_durations[video_index]
                    if video_index < len(video_durations)
                    else None
                )
                start = max(0.0, float(moment.get('start', 0.0)))
                end = max(start + 0.5, float(moment.get('end', start + 0.5)))
                if duration_hint and duration_hint > 0:
                    end = min(end, duration_hint)
                    if end - start < 0.5:
                        continue
                subtitle_path = (
                    subtitle_files[video_index]
                    if video_index < len(subtitle_files)
                    else None
                )
                clips.append({
                    'file_path': file_path,
                    'start': start,
                    'end': end,
                    'subtitle_path': subtitle_path
                })
        
        # Compile video in TikTok format (9:16)
        output_path = TEMP_DIR / f"compilation_{session_id}.mp4"
        
        logger.info(f"Compiling {len(clips)} clips into TikTok format...")
        _update_task(session_id, 'compile', progress=50, detail='Encodage en cours')
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
                    if file_path and os.path.exists(file_path):
                        os.remove(file_path)
                
                # Clean up subtitle files
                for sub_path in subtitle_files:
                    if sub_path and os.path.exists(sub_path):
                        os.remove(sub_path)

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
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.error(f"Error removing file {file_path}: {e}")

        for sub_path in session_data.get('subtitle_files', []):
            try:
                if sub_path and os.path.exists(sub_path):
                    os.remove(sub_path)
            except Exception as e:
                logger.error(f"Error removing subtitle file {sub_path}: {e}")

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
