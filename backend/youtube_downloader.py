"""
YouTube Downloader Module
Handles downloading videos from YouTube using yt-dlp
"""

import yt_dlp
import subprocess
import logging
from pathlib import Path
import os
import re
import sys
import time

logger = logging.getLogger(__name__)


class YouTubeDownloader:
    def __init__(self, temp_dir):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
        # Optional cookie file for YouTube auth (set env YTDLP_COOKIES=/path/to/cookies.txt)
        default_cookie_path = Path("/tmp/ytdlp_public_cookies.txt")
        self.cookie_file = Path(os.environ.get("YTDLP_COOKIES", default_cookie_path))
        self.cookie_ttl_seconds = 3600  # refresh cookies every hour
        self.generator_script = Path(__file__).parent / "generate_public_cookies.py"

        # Generate cookies upfront if needed (non-auth public session)
        self.ensure_cookies()
    
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
            
            if self.cookie_file and Path(self.cookie_file).exists():
                ydl_opts['cookiefile'] = str(self.cookie_file)

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
    
    def download_video(self, url, session_id, video_id, progress_callback=None):
        """Download video and return the file path"""
        try:
            output_path = self.temp_dir / f"{session_id}_{video_id}.mp4"
            
            ydl_opts = {
                'format': 'best[ext=mp4][height<=1080]/best[ext=mp4]/best',
                'outtmpl': str(output_path),
                'quiet': True,
                'no_warnings': True,
                'extract_audio': False,
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }],
            }

            if self.cookie_file and Path(self.cookie_file).exists():
                ydl_opts['cookiefile'] = str(self.cookie_file)

            if progress_callback:
                def _hook(d):
                    if d.get('status') == 'downloading':
                        downloaded = d.get('downloaded_bytes') or 0
                        total = d.get('total_bytes') or d.get('total_bytes_estimate')
                        try:
                            progress_callback(downloaded, total)
                        except Exception:
                            # Do not break download if callback fails
                            pass
                ydl_opts['progress_hooks'] = [_hook]
                ydl_opts['noprogress'] = True
            
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
            
            logger.info(f"Successfully downloaded to {output_path}")
            return str(output_path)
        
        except Exception as e:
            logger.error(f"Error downloading video {url}: {e}")
            raise

    # Internal helpers
    def ensure_cookies(self):
        """Generate a fresh public cookie jar if missing or stale."""
        try:
            path = Path(self.cookie_file)
            if path.exists():
                age = time.time() - path.stat().st_mtime
                if age < self.cookie_ttl_seconds:
                    return

            if not self.generator_script.exists():
                logger.warning("Cookie generator script not found; continuing without cookies.")
                return

            logger.info("Generating fresh public cookies for YouTube (headless Playwright)...")
            result = subprocess.run(
                [sys.executable, str(self.generator_script), "--output", str(path)],
                capture_output=True,
                text=True,
                timeout=120
            )
            if result.returncode != 0:
                logger.warning(f"Failed to generate cookies: {result.stderr.strip()}")
            else:
                logger.info(f"Public cookies generated at {path}")
        except Exception as e:
            logger.warning(f"Could not generate cookies automatically: {e}")
