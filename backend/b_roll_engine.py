
import logging
import random
import subprocess
from pathlib import Path
import re

logger = logging.getLogger(__name__)

class BRollEngine:
    def __init__(self, temp_dir='/tmp'):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def detect_static_segments(self, video_path, threshold=5.0, min_duration=2.0):
        """
        Naive detection of "static" segments.
        In a real scenario, this would compare frame histograms.
        For now, we will simulate it or use a very simple scene change detector fallback 
        if OpenCV isn't heavy.
        
        Actually, let's randomly pick segments for this "Simulated AI" phase 
        to ensure the user sees the effect immediately without heavy compute.
        """
        # "Simulated" Intelligence for immediate feedback
        # Returns list of (start, end)
        import os
        try:
             # Get duration
            cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            duration = float(result.stdout.strip())
            
            segments = []
            # Inject 1-2 B-Rolls for every 30 seconds
            count = max(1, int(duration / 15))
            
            for _ in range(count):
                start = random.uniform(1.0, duration - 3.0)
                length = random.uniform(2.0, 4.0)
                segments.append((start, start + length))
                
            return sorted(segments, key=lambda x: x[0])
            
        except Exception as e:
            logger.error(f"Error detecting b-roll spots: {e}")
            return []

    def generate_b_roll_content(self, keyword, duration, width=1080, height=1920):
        """
        Generates a placeholder B-Roll video clip using FFmpeg lavfi.
        """
        output_path = self.temp_dir / f"brap_{random.randint(1000,9999)}.mp4"
        
        # Determine color based on keyword
        color = "blue"
        if "fire" in keyword or "hot" in keyword: color = "red"
        if "money" in keyword: color = "green"
        
        # Create a generated video with text
        cmd = [
            'ffmpeg', '-y',
            '-f', 'lavfi', '-i', f'color=c={color}:s={width}x{height}:d={duration}',
            '-vf', f"drawtext=text='B-ROLL\\: {keyword}':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2",
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            str(output_path)
        ]
        
        subprocess.run(cmd, check=True)
        return str(output_path)

    def select_keyword(self, time_point):
        """
        In a real system, this would look at the transcript at this timestamp.
        For now, returns a random engaging keyword.
        """
        keywords = ["MONEY", "SPEED", "WOW", "SECRET", "TECH", "FUTURE", "HUSTLE"]
        return random.choice(keywords)

    def apply_b_roll(self, video_path, output_path):
        """
        Detects spot, generates placeholders, and overlays them.
        """
        segments = self.detect_static_segments(video_path)
        if not segments:
            # Copy if no b-roll
            if video_path != output_path:
                import shutil
                shutil.copy2(video_path, output_path)
            return output_path
            
        # We need to construct a complex filter to OVERLAY these clips at specific times.
        # [0:v][1:v]overlay=enable='between(t,start,end)'[v]
        
        inputs = ['-i', video_path]
        filter_parts = []
        last_out = "[0:v]"
        
        for idx, (start, end) in enumerate(segments):
            duration = end - start
            keyword = self.select_keyword(start)
            b_roll_path = self.generate_b_roll_content(keyword, duration)
            
            inputs.extend(['-i', b_roll_path])
            # input index is idx+1
            
            # Simple overlay? Or replace? 
            # Overlay sits on top.
            filter_parts.append(f"{last_out}[{idx+1}:v]overlay=enable='between(t,{start:.2f},{end:.2f})':shortest=0[v{idx}]")
            last_out = f"[v{idx}]"
            
        filter_complex = ";".join(filter_parts)
        
        cmd = [
            'ffmpeg', '-y',
            *inputs,
            '-filter_complex', filter_complex,
            '-map', last_out,
            '-map', '0:a', # Keep original audio
            '-c:v', 'libx264',
            '-c:a', 'copy',
            output_path
        ]
        
        try:
            subprocess.run(cmd, check=True)
            return output_path
        except Exception as e:
            logger.error(f"Error applying b-roll: {e}")
            return video_path
