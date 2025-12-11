"""
Video Processor Module
Handles video compilation and format conversion to TikTok format (9:16)
"""

import subprocess
import logging
import os
import json
import statistics
import shutil
import tempfile
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, temp_dir):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def _time_str_to_seconds(self, timestamp: str) -> float:
        try:
            hms, millis = timestamp.split(',')
            hours, minutes, seconds = hms.split(':')
            return (
                int(hours) * 3600
                + int(minutes) * 60
                + int(seconds)
                + int(millis) / 1000.0
            )
        except Exception:
            return 0.0

    def _seconds_to_time_str(self, seconds: float) -> str:
        total_ms = max(0, int(round(seconds * 1000)))
        ms = total_ms % 1000
        total_seconds = total_ms // 1000
        s = total_seconds % 60
        total_minutes = total_seconds // 60
        m = total_minutes % 60
        h = total_minutes // 60
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    def _slice_subtitles(self, subtitle_path, clip_start, clip_end, work_dir):
        """Trim and shift subtitles to align with a clip window"""
        if not subtitle_path or not Path(subtitle_path).exists():
            return None

        try:
            raw_lines = Path(subtitle_path).read_text(encoding='utf-8', errors='ignore').splitlines()
        except Exception:
            return None

        entries = []
        idx = 0
        while idx < len(raw_lines):
            line = raw_lines[idx].strip()
            if not line:
                idx += 1
                continue

            try:
                int(line)
            except ValueError:
                idx += 1
                continue

            idx += 1
            if idx >= len(raw_lines):
                break

            time_line = raw_lines[idx].strip()
            idx += 1
            if '-->' not in time_line:
                continue

            try:
                start_str, end_str = [segment.strip() for segment in time_line.split('-->')]
                start_time = self._time_str_to_seconds(start_str)
                end_time = self._time_str_to_seconds(end_str)
            except Exception:
                continue

            text_lines = []
            while idx < len(raw_lines) and raw_lines[idx].strip():
                text_lines.append(raw_lines[idx].strip())
                idx += 1

            # Skip the blank separator
            while idx < len(raw_lines) and not raw_lines[idx].strip():
                idx += 1

            if not text_lines:
                continue

            entries.append((start_time, end_time, '\n'.join(text_lines)))

        if not entries:
            return None

        clip_duration = clip_end - clip_start
        trimmed_entries = []
        for start_time, end_time, text in entries:
            adjusted_start = start_time - clip_start
            adjusted_end = end_time - clip_start

            if adjusted_end <= 0 or adjusted_start >= clip_duration:
                continue

            adjusted_start = max(0.0, adjusted_start)
            adjusted_end = min(clip_duration, adjusted_end)
            trimmed_entries.append((adjusted_start, adjusted_end, text))

        if not trimmed_entries:
            return None

        output_path = Path(work_dir) / f"sub_{os.getpid()}_{int(clip_start * 1000)}.srt"
        with open(output_path, 'w', encoding='utf-8') as handle:
            for idx, (start_time, end_time, text) in enumerate(trimmed_entries, start=1):
                handle.write(f"{idx}\n")
                handle.write(
                    f"{self._seconds_to_time_str(start_time)} --> {self._seconds_to_time_str(end_time)}\n"
                )
                handle.write(f"{text}\n\n")

        return str(output_path)
    
    def _get_video_resolution(self, video_path):
        """Return width and height information for a video"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height',
                '-of', 'json',
                video_path
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode != 0:
                return {}
            data = json.loads(result.stdout)
            if not data.get('streams'):
                return {}
            stream = data['streams'][0]
            return {
                'width': stream.get('width'),
                'height': stream.get('height')
            }
        except Exception as exc:
            logger.warning(f"Unable to read video resolution: {exc}")
            return {}

    def _estimate_focus_center(self, video_path, sample_frames=12):
        """Estimate the horizontal focus point to drive smart cropping"""
        try:
            import cv2
        except ImportError:
            logger.warning("OpenCV not installed; falling back to center crop")
            return 0.5

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return 0.5

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        target_samples = sample_frames if frame_count == 0 else min(sample_frames, frame_count)
        step = max(frame_count // target_samples, 1) if frame_count else 1

        focus_points = []
        current = 0
        while True:
            if frame_count:
                cap.set(cv2.CAP_PROP_POS_FRAMES, current)

            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            response = np.abs(laplacian)
            height, width = response.shape
            slices = 6
            slice_width = max(1, width // slices)
            best_score = -1
            best_center = width / 2

            for idx in range(slices):
                start = idx * slice_width
                end = width if idx == slices - 1 else (idx + 1) * slice_width
                region = response[:, start:end]
                if region.size == 0:
                    continue
                score = float(np.mean(region))
                if score > best_score:
                    best_score = score
                    best_center = start + (end - start) / 2

            focus_points.append(best_center / max(width, 1))

            if len(focus_points) >= target_samples:
                break

            if frame_count:
                current += step
                if current >= frame_count:
                    break
            else:
                # Sequential sampling when frame count is unavailable
                continue

        cap.release()

        if not focus_points:
            return 0.5

        median_focus = statistics.median(focus_points)
        return float(max(0.1, min(0.9, median_focus)))
    
    def _create_work_dir(self):
        path = Path(tempfile.mkdtemp(prefix='session_', dir=str(self.temp_dir)))
        logger.debug(f"Created work directory {path}")
        return path
    
    def _write_concat_manifest(self, clips, manifest_path: Path):
        """Write a concat manifest with safety checks"""
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as handle:
            handle.write("ffconcat version 1.0\n")
            for clip in clips:
                clip_path = Path(clip)
                if not clip_path.exists():
                    raise FileNotFoundError(f"Missing clip for concat: {clip_path}")
                safe_path = str(clip_path.resolve()).replace("'", "'\\''")
                handle.write(f"file '{safe_path}'\n")

    def check_ffmpeg(self):
        """Check if FFmpeg is available"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False
    
    def extract_clip(self, input_path, output_path, start_time, end_time):
        """Extract a clip from a video"""
        try:
            duration = end_time - start_time
            
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output file
                '-ss', str(start_time),
                '-i', input_path,
                '-t', str(duration),
                '-c', 'copy',  # Copy codec for speed
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg error: {result.stderr}")
            
            logger.info(f"Extracted clip: {start_time:.1f}s - {end_time:.1f}s")
            return output_path
        
        except Exception as e:
            logger.error(f"Error extracting clip: {e}")
            raise
    
    def convert_to_vertical(self, input_path, output_path, quality='720p', subtitle_path=None):
        """
        Convert video to vertical TikTok format (9:16)
        Applies smart cropping to focus on center/action and optionally burns subtitles
        """
        try:
            # Determine output resolution based on quality
            if quality == '1080p':
                width, height = 1080, 1920
                bitrate = '5000k'
            elif quality == '720p':
                width, height = 720, 1280
                bitrate = '2500k'
            else:  # 480p
                width, height = 480, 854
                bitrate = '1500k'

            subtitle_filter = ""
            if subtitle_path and Path(subtitle_path).exists():
                escaped = str(Path(subtitle_path)).replace("'", "\\'")
                style = (
                    "Fontname=Montserrat,Fontsize=26,PrimaryColour=&H00FFFFFF&,BackColour=&H60000000&,"
                    "Outline=1,Shadow=1,MarginV=40,MarginL=36,MarginR=36"
                )
                subtitle_filter = f",subtitles='{escaped}':force_style='{style}'"
            
            # Use crop and scale filters for vertical format
            # Smart cropping tries to keep the most active area visible
            metadata = self._get_video_resolution(input_path)
            src_width = metadata.get('width')
            src_height = metadata.get('height')
            target_aspect = width / height if height else (9 / 16)
            filter_complex = None
            focus_center = 0.5
            smart_crop_applied = False

            if src_width and src_height:
                src_aspect = src_width / src_height if src_height else target_aspect
                if src_aspect > target_aspect + 0.02:
                    # Wide video – keep more of the frame visible with a gentle dezoom
                    focus_center = self._estimate_focus_center(input_path)

                    # Background layer: fill the 9:16 frame, cropped around the focus point, with blur
                    scale_ratio = height / src_height
                    scaled_width = src_width * scale_ratio
                    crop_x = max(
                        0.0,
                        min(scaled_width * focus_center - (width / 2), scaled_width - width)
                    )

                    # Foreground layer: slightly smaller to reduce aggressive zooming
                    dezoom_ratio = 0.94
                    fg_width = max(2, int(width * dezoom_ratio))
                    fg_height = max(2, int(height * dezoom_ratio))
                    fg_scaled_height = int(fg_width / max(src_aspect, 0.1))
                    if fg_scaled_height > fg_height:
                        fg_scaled_height = fg_height
                        fg_width = int(fg_scaled_height * src_aspect)

                    pad_x = int(max(0, min(width * focus_center - fg_width / 2, width - fg_width)))
                    pad_y = max((height - fg_scaled_height) // 2, 0)

                    filter_complex = (
                        f"[0:v]scale=-2:{height}:force_original_aspect_ratio=increase,"
                        f"crop={width}:{height}:{crop_x:.2f}:0,"
                        f"gblur=sigma=20[bg];"
                        f"[0:v]scale={fg_width}:{fg_height}:force_original_aspect_ratio=decrease,"
                        f"pad={width}:{height}:{pad_x}:{pad_y}:color=black[fg];"
                        f"[bg][fg]overlay=0:0,setsar=1{subtitle_filter}[v]"
                    )
                    smart_crop_applied = True

            if not filter_complex:
                if src_width and src_height and src_width / src_height <= target_aspect + 0.01:
                    filter_complex = (
                        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
                        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
                        f"setsar=1{subtitle_filter}[v]"
                    )
                else:
                    filter_complex = (
                        f"[0:v]scale={width*2}:{height*2}:force_original_aspect_ratio=increase,"
                        f"crop={width}:{height},"
                        f"setsar=1{subtitle_filter}[v]"
                    )

            if smart_crop_applied:
                logger.info(f"Smart focus crop applied at {focus_center:.2f}")
            
            cmd = [
                'ffmpeg',
                '-y',
                '-i', input_path,
                '-filter_complex', filter_complex,
                '-map', '[v]',
                '-map', '0:a?',  # Copy audio if exists
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-b:v', bitrate,
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2',
                output_path
            ]
            
            logger.info(f"Converting to vertical format: {width}x{height}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg error: {result.stderr}")
            
            logger.info(f"Converted to vertical format successfully")
            return output_path
        
        except Exception as e:
            logger.error(f"Error converting to vertical: {e}")
            raise
    
    def add_transitions(self, clips, output_path):
        """Add smooth transitions between clips"""
        try:
            if len(clips) < 2:
                return clips[0] if clips else None
            
            # Build filter complex for crossfade transitions
            filter_parts = []
            last_output = '[0:v]'
            
            for i in range(len(clips) - 1):
                # Crossfade transition (0.5 seconds)
                filter_parts.append(
                    f"{last_output}[{i+1}:v]xfade=transition=fade:duration=0.5:offset={i*4.5}[v{i}]"
                )
                last_output = f'[v{i}]'
            
            filter_complex = ';'.join(filter_parts)
            
            cmd = ['ffmpeg', '-y']
            
            # Add all input clips
            for clip in clips:
                cmd.extend(['-i', clip])
            
            # Add filter and output
            cmd.extend([
                '-filter_complex', filter_complex,
                '-map', last_output,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                output_path
            ])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg error: {result.stderr}")
            
            return output_path
        
        except Exception as e:
            logger.error(f"Error adding transitions: {e}")
            raise
    
    def compile_tiktok_video(self, clips_data, output_path, quality='720p'):
        """
        Main compilation function
        Takes list of clips with {file_path, start, end, subtitle_path?}
        Creates a vertical TikTok video with transitions
        """
        work_dir = self._create_work_dir()
        temp_clips = []
        try:
            logger.info(f"Compiling {len(clips_data)} clips into TikTok format")
            
            # Step 1: Extract and prepare clips
            for idx, clip_data in enumerate(clips_data):
                # Extract clip
                clip_path = work_dir / f"clip_{idx}_{os.getpid()}.mp4"
                self.extract_clip(
                    clip_data['file_path'],
                    str(clip_path),
                    clip_data['start'],
                    clip_data['end']
                )
                
                # Convert to vertical format
                vertical_path = work_dir / f"vertical_{idx}_{os.getpid()}.mp4"
                sliced_subtitle = None
                if clip_data.get('subtitle_path'):
                    sliced_subtitle = self._slice_subtitles(
                        clip_data['subtitle_path'],
                        clip_data['start'],
                        clip_data['end'],
                        work_dir
                    )

                self.convert_to_vertical(
                    str(clip_path),
                    str(vertical_path),
                    quality,
                    subtitle_path=sliced_subtitle
                )
                
                temp_clips.append(str(vertical_path))
                
                if clip_path.exists():
                    clip_path.unlink()
            
            logger.info("All clips extracted and converted to vertical format")
            
            # Step 2: Concatenate clips with transitions
            if len(temp_clips) == 0:
                raise RuntimeError("Aucun clip à compiler. Vérifie les moments détectés.")
            if len(temp_clips) == 1:
                os.rename(temp_clips[0], output_path)
            else:
                concat_file = work_dir / f"concat_{os.getpid()}.txt"
                self._write_concat_manifest(temp_clips, concat_file)
                
                cmd = [
                    'ffmpeg',
                    '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', str(concat_file),
                    '-c', 'copy',
                    output_path
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=600
                )
                
                if result.returncode != 0:
                    cmd = [
                        'ffmpeg',
                        '-y',
                        '-f', 'concat',
                        '-safe', '0',
                        '-i', str(concat_file),
                        '-c:v', 'libx264',
                        '-preset', 'medium',
                        '-crf', '23',
                        '-c:a', 'aac',
                        output_path
                    ]
                    
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=600
                    )
                    
                    if result.returncode != 0:
                        raise RuntimeError(f"FFmpeg concat error: {result.stderr}")
            
            logger.info(f"Compilation complete: {output_path}")
            
            if not os.path.exists(output_path):
                raise RuntimeError("Output file was not created")
            
            file_size = os.path.getsize(output_path)
            if file_size < 1000:
                raise RuntimeError(f"Output file too small ({file_size} bytes)")
            
            logger.info(f"Output file size: {file_size / (1024*1024):.2f} MB")
            
            return output_path
        
        except Exception as e:
            logger.error(f"Error in compile_tiktok_video: {e}")
            raise
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
