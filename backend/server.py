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
from datetime import datetime, timedelta
from pathlib import Path

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
        
        # Create session
        session_id = str(uuid.uuid4())
        session_data = {
            'id': session_id,
            'created_at': datetime.now().isoformat(),
            'videos': videos,
            'settings': settings,
            'downloaded_files': [],
            'moments': [],
            'status': 'processing'
        }
        
        sessions[session_id] = session_data
        
        # Download videos and detect moments
        all_moments = []
        downloaded_files = []
        subtitle_files = []
        
        for idx, video in enumerate(videos):
            try:
                video_id = video['id']
                video_url = video['url']
                
                logger.info(f"Downloading video {idx + 1}/{len(videos)}: {video['title']}")
                
                # Download video
                video_path, subtitle_path = youtube_downloader.download_video(
                    video_url,
                    session_id,
                    video_id,
                    download_subtitles=include_subtitles
                )
                downloaded_files.append(video_path)
                subtitle_files.append(subtitle_path)
                
                logger.info(f"Analyzing video for best moments...")
                
                # Detect best moments
                if auto_detect:
                    moments = moment_detector.detect_moments(
                        video_path,
                        video['duration'],
                        output_duration // len(videos),
                        video['title']
                    )
                else:
                    # Simple distribution if auto-detect is off
                    moments = moment_detector.distribute_moments(
                        video['duration'],
                        output_duration // len(videos),
                        video['title']
                    )
                
                # Add video metadata to moments
                for moment in moments:
                    moment['videoId'] = video_id
                    moment['videoIndex'] = idx
                    moment['videoTitle'] = video['title']
                
                all_moments.extend(moments)
                logger.info(f"Detected {len(moments)} moments from {video['title']}")
                
            except Exception as e:
                logger.error(f"Error processing video {video['title']}: {e}")
                continue
        
        # Sort moments by score and select best ones, keeping the strongest clips first
        clip_duration = 4.5
        target_clip_count = int(output_duration / clip_duration)
        top_moments = sorted(
            all_moments,
            key=lambda x: (-x['score'], x.get('start', 0.0))
        )[:target_clip_count]
        
        # Update session
        session_data['downloaded_files'] = downloaded_files
        session_data['moments'] = top_moments
        session_data['status'] = 'ready'
        session_data['subtitle_files'] = subtitle_files
        
        logger.info(f"Session {session_id} ready with {len(top_moments)} moments")
        
        # Return moments for preview (without file paths)
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
            for idx, moment in enumerate(top_moments)
        ]
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'moments': moments_preview,
            'videoCount': len(videos),
            'clipCount': len(top_moments),
            'totalDuration': output_duration
        })
    
    except Exception as e:
        logger.error(f"Error in process_videos: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


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
        
        moments = session_data['moments']
        downloaded_files = session_data['downloaded_files']
        subtitle_files = session_data.get('subtitle_files', [])
        
        # Create clips data for compilation
        clips = []
        for moment in moments:
            video_index = moment['videoIndex']
            if video_index < len(downloaded_files):
                clips.append({
                    'file_path': downloaded_files[video_index],
                    'start': moment['start'],
                    'end': moment['end'],
                    'subtitle_path': subtitle_files[video_index] if video_index < len(subtitle_files) else None
                })
        
        # Compile video in TikTok format (9:16)
        output_path = TEMP_DIR / f"compilation_{session_id}.mp4"
        
        logger.info(f"Compiling {len(clips)} clips into TikTok format...")
        video_processor.compile_tiktok_video(
            clips,
            str(output_path),
            quality
        )
        
        logger.info(f"Video compilation complete: {output_path}")
        
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
                if os.path.exists(file_path):
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
