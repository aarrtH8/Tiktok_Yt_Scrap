"""
YouTube Downloader Module
Handles downloading videos from YouTube using yt-dlp
"""

import yt_dlp
import subprocess
import logging
from pathlib import Path
import re

logger = logging.getLogger(__name__)


class YouTubeDownloader:
    def __init__(self, temp_dir):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
    
    def check_ytdlp(self):
        """Check if yt-dlp is available"""
        try:
            result = subprocess.run(
                ['yt-dlp', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False
    
    def extract_video_id(self, url):
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        raise ValueError(f"Could not extract video ID from URL: {url}")
    
    def get_video_metadata(self, url):
        """Get video metadata without downloading"""
        try:
            video_id = self.extract_video_id(url)
            
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                duration = info.get('duration', 0)
                duration_formatted = f"{duration // 60}:{duration % 60:02d}"
                
                return {
                    'id': video_id,
                    'title': info.get('title', 'Unknown Title'),
                    'channel': info.get('uploader', 'Unknown Channel'),
                    'duration': duration,
                    'duration_formatted': duration_formatted,
                    'thumbnail': info.get('thumbnail', ''),
                    'description': info.get('description', ''),
                    'view_count': info.get('view_count', 0),
                    'like_count': info.get('like_count', 0)
                }
        
        except Exception as e:
            logger.error(f"Error getting metadata for {url}: {e}")
            raise
    
    def _find_subtitle_file(self, base_output: Path):
        """Locate a downloaded subtitle file near the video output"""
        base = base_output.with_suffix('')
        candidates = list(base.parent.glob(f"{base.name}*.srt"))

        if candidates:
            return candidates[0]

        # Try to convert VTT to SRT if available
        vtt_candidates = list(base.parent.glob(f"{base.name}*.vtt"))
        if not vtt_candidates:
            return None

        vtt_path = vtt_candidates[0]
        srt_path = vtt_path.with_suffix('.srt')
        try:
            cmd = [
                'ffmpeg',
                '-y',
                '-i',
                str(vtt_path),
                str(srt_path)
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode == 0 and srt_path.exists():
                return srt_path
        except Exception as exc:
            logger.warning(f"Failed to convert VTT subtitles: {exc}")

        return None

    def download_video(self, url, session_id, video_id, download_subtitles=True):
        """Download video and optional subtitles. Returns (video_path, subtitle_path)."""
        try:
            output_path = self.temp_dir / f"{session_id}_{video_id}.mp4"

            ydl_opts = {
                'format': 'best[ext=mp4][height<=1080]/best[ext=mp4]/best',
                'outtmpl': str(output_path),
                'quiet': False,
                'no_warnings': False,
                'extract_audio': False,
                'writesubtitles': download_subtitles,
                'writeautomaticsub': download_subtitles,
                'subtitlesformat': 'srt',
                'subtitleslangs': ['fr', 'en', 'fr.*', 'en.*'],
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }],
            }

            logger.info(f"Downloading video {video_id} from {url}")

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            # yt-dlp might add extension, check for the file
            if not output_path.exists():
                # Try with different extensions
                for ext in ['.mp4', '.mkv', '.webm']:
                    alt_path = output_path.with_suffix(ext)
                    if alt_path.exists():
                        output_path = alt_path
                        break

            if not output_path.exists():
                raise FileNotFoundError(f"Downloaded video not found at {output_path}")

            subtitle_path = None
            if download_subtitles:
                subtitle_path = self._find_subtitle_file(output_path)
                if subtitle_path:
                    logger.info(f"Captured subtitles at {subtitle_path}")
                else:
                    logger.info("No subtitles available for this video")

            logger.info(f"Successfully downloaded to {output_path}")
            return str(output_path), str(subtitle_path) if subtitle_path else None

        except Exception as e:
            logger.error(f"Error downloading video {url}: {e}")
            raise
