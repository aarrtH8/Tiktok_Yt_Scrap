"""
Video Processor Module
Handles video compilation and format conversion to TikTok format (9:16)
"""

import subprocess
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class VideoProcessor:
    def __init__(self, temp_dir):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
    
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
    
    def convert_to_vertical(self, input_path, output_path, quality='720p'):
        """
        Convert video to vertical TikTok format (9:16)
        Applies smart cropping to focus on center/action
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

            # Scale to fit inside target, then pad to 9:16 to avoid trop de zoom
            filter_complex = (
                f"[0:v]scale={width}:-2:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v]"
            )
            
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
        Takes list of clips with {file_path, start, end}
        Creates a vertical TikTok video with transitions
        """
        try:
            logger.info(f"Compiling {len(clips_data)} clips into TikTok format")
            
            # Step 1: Extract and prepare clips
            temp_clips = []
            for idx, clip_data in enumerate(clips_data):
                # Extract clip
                clip_path = self.temp_dir / f"clip_{idx}_{os.getpid()}.mp4"
                self.extract_clip(
                    clip_data['file_path'],
                    str(clip_path),
                    clip_data['start'],
                    clip_data['end']
                )
                
                # Convert to vertical format
                vertical_path = self.temp_dir / f"vertical_{idx}_{os.getpid()}.mp4"
                self.convert_to_vertical(str(clip_path), str(vertical_path), quality)
                
                temp_clips.append(str(vertical_path))
                
                # Clean up intermediate clip
                if clip_path.exists():
                    os.remove(clip_path)
            
            logger.info("All clips extracted and converted to vertical format")
            
            # Step 2: Concatenate clips with transitions
            if len(temp_clips) == 1:
                # Single clip, just copy
                os.rename(temp_clips[0], output_path)
            else:
                # Create concat file
                concat_file = self.temp_dir / f"concat_{os.getpid()}.txt"
                with open(concat_file, 'w') as f:
                    for clip in temp_clips:
                        f.write(f"file '{clip}'\n")
                
                # Concatenate with crossfade
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
                    # Fallback: re-encode if concat fails
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
                
                # Clean up concat file
                if concat_file.exists():
                    os.remove(concat_file)
            
            # Clean up temporary clips
            for clip in temp_clips:
                try:
                    if os.path.exists(clip):
                        os.remove(clip)
                except Exception as e:
                    logger.warning(f"Could not remove temp clip {clip}: {e}")
            
            logger.info(f"Compilation complete: {output_path}")
            
            # Verify output file exists and has size
            if not os.path.exists(output_path):
                raise RuntimeError("Output file was not created")
            
            file_size = os.path.getsize(output_path)
            if file_size < 1000:  # Less than 1KB is probably invalid
                raise RuntimeError(f"Output file too small ({file_size} bytes)")
            
            logger.info(f"Output file size: {file_size / (1024*1024):.2f} MB")
            
            return output_path
        
        except Exception as e:
            logger.error(f"Error in compile_tiktok_video: {e}")
            
            # Clean up on error
            for clip in temp_clips:
                try:
                    if os.path.exists(clip):
                        os.remove(clip)
                except Exception:
                    pass
            
            raise
