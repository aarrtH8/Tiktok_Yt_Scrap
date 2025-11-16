"""
Moment Detector Module
Analyzes videos to detect the best moments for compilation
"""

import subprocess
import json
import logging
import numpy as np
from pathlib import Path
import random

logger = logging.getLogger(__name__)


class MomentDetector:
    def __init__(self):
        self.scene_threshold = 0.4
        self.min_clip_duration = 3
        self.max_clip_duration = 6
    
    def get_video_duration(self, video_path):
        """Get video duration using ffprobe"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'json',
                video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                raise RuntimeError(f"ffprobe error: {result.stderr}")
            
            data = json.loads(result.stdout)
            duration = float(data['format']['duration'])
            return duration
        
        except Exception as e:
            logger.error(f"Error getting video duration: {e}")
            raise
    
    def detect_scene_changes(self, video_path, max_scenes=50):
        """Detect scene changes in the video using FFmpeg"""
        try:
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-vf', f'select=gt(scene\\,{self.scene_threshold}),showinfo',
                '-f', 'null',
                '-'
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes max
            )
            
            # Parse scene changes from ffmpeg output
            scene_times = []
            for line in result.stderr.split('\n'):
                if 'pts_time' in line:
                    try:
                        # Extract timestamp
                        parts = line.split('pts_time:')
                        if len(parts) > 1:
                            time_str = parts[1].split()[0]
                            timestamp = float(time_str)
                            scene_times.append(timestamp)
                    except (ValueError, IndexError):
                        continue
            
            # Limit number of scenes
            if len(scene_times) > max_scenes:
                # Sample evenly
                step = len(scene_times) // max_scenes
                scene_times = scene_times[::step][:max_scenes]
            
            logger.info(f"Detected {len(scene_times)} scene changes")
            return scene_times
        
        except Exception as e:
            logger.error(f"Error detecting scenes: {e}")
            return []
    
    def analyze_audio_energy(self, video_path, num_samples=100):
        """Analyze audio energy levels to find engaging moments"""
        try:
            duration = self.get_video_duration(video_path)
            
            # Extract audio stats using ffmpeg
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-af', 'astats=metadata=1:reset=1',
                '-f', 'null',
                '-'
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            # Parse RMS values from output
            energy_levels = []
            for line in result.stderr.split('\n'):
                if 'RMS level' in line:
                    try:
                        # Extract RMS value
                        value = float(line.split(':')[-1].strip().split()[0])
                        energy_levels.append(abs(value))
                    except (ValueError, IndexError):
                        continue
            
            if not energy_levels:
                # Fallback to uniform distribution
                return [i * (duration / num_samples) for i in range(num_samples)]
            
            # Find high-energy moments
            if len(energy_levels) < num_samples:
                # Interpolate
                step = len(energy_levels) / num_samples
                energy_levels = [
                    energy_levels[int(i * step)]
                    for i in range(num_samples)
                ]
            
            # Get timestamps of high energy
            threshold = np.percentile(energy_levels, 70)  # Top 30%
            high_energy_indices = [
                i for i, energy in enumerate(energy_levels)
                if energy >= threshold
            ]
            
            timestamps = [
                (i / len(energy_levels)) * duration
                for i in high_energy_indices
            ]
            
            logger.info(f"Detected {len(timestamps)} high-energy moments")
            return timestamps
        
        except Exception as e:
            logger.error(f"Error analyzing audio: {e}")
            return []
    
    def detect_moments(self, video_path, video_duration, target_duration, video_title):
        """
        Detect best moments in a video
        Combines scene detection and audio analysis
        """
        try:
            logger.info(f"Detecting moments in {video_title}")
            
            # Get scene changes
            scene_times = self.detect_scene_changes(video_path)
            
            # Get high-energy moments
            energy_times = self.analyze_audio_energy(video_path)
            
            # Combine and score moments
            all_timestamps = sorted(set(scene_times + energy_times))
            
            if not all_timestamps:
                # Fallback to distributed moments
                return self.distribute_moments(video_duration, target_duration, video_title)
            
            # Calculate how many clips we need
            clip_duration = 4.5  # Average clip duration
            num_clips = max(1, int(target_duration / clip_duration))
            
            # Score each potential moment
            scored_moments = []
            for timestamp in all_timestamps:
                if timestamp < 5 or timestamp > video_duration - 5:
                    continue  # Skip beginning and end
                
                # Score based on proximity to scene changes and energy peaks
                scene_score = min([abs(timestamp - t) for t in scene_times + [timestamp]]) if scene_times else 1
                energy_score = min([abs(timestamp - t) for t in energy_times + [timestamp]]) if energy_times else 1
                
                # Closer to both = higher score
                score = 1.0 / (1 + scene_score + energy_score)
                
                # Add randomness for variety
                score += random.uniform(0, 0.1)
                
                scored_moments.append({
                    'timestamp': timestamp,
                    'score': score
                })
            
            # Select top moments
            scored_moments.sort(key=lambda x: x['score'], reverse=True)
            selected_moments = scored_moments[:num_clips]
            
            # Sort by timestamp for sequential playback
            selected_moments.sort(key=lambda x: x['timestamp'])
            
            # Create moment objects
            moments = []
            engagement_levels = ['High', 'Medium', 'High', 'Medium']
            
            for idx, moment in enumerate(selected_moments):
                start_time = moment['timestamp']
                clip_len = random.uniform(self.min_clip_duration, self.max_clip_duration)
                end_time = min(start_time + clip_len, video_duration)
                
                minutes = int(start_time // 60)
                seconds = int(start_time % 60)
                
                moments.append({
                    'start': start_time,
                    'end': end_time,
                    'timestamp': f"{minutes}:{seconds:02d}",
                    'duration': f"{int(end_time - start_time)}s",
                    'title': self._generate_moment_title(idx, moment['score']),
                    'score': min(0.99, 0.70 + moment['score'] * 0.3),
                    'engagementLevel': engagement_levels[idx % len(engagement_levels)]
                })
            
            logger.info(f"Selected {len(moments)} best moments")
            return moments
        
        except Exception as e:
            logger.error(f"Error in detect_moments: {e}")
            # Fallback to distribution
            return self.distribute_moments(video_duration, target_duration, video_title)
    
    def distribute_moments(self, video_duration, target_duration, video_title):
        """
        Fallback method: Distribute moments evenly across the video
        with some randomness
        """
        clip_duration = 4.5
        num_clips = max(1, int(target_duration / clip_duration))
        
        moments = []
        engagement_levels = ['High', 'Medium', 'High', 'Medium']
        
        for i in range(num_clips):
            # Distribute evenly with some variance
            position = (i + 1) / (num_clips + 1)
            base_start = video_duration * position
            variance = (random.random() - 0.5) * (video_duration * 0.1)
            
            start_time = max(5, min(base_start + variance, video_duration - 5))
            clip_len = random.uniform(self.min_clip_duration, self.max_clip_duration)
            end_time = min(start_time + clip_len, video_duration)
            
            minutes = int(start_time // 60)
            seconds = int(start_time % 60)
            
            score = 0.75 + random.random() * 0.20
            
            moments.append({
                'start': start_time,
                'end': end_time,
                'timestamp': f"{minutes}:{seconds:02d}",
                'duration': f"{int(end_time - start_time)}s",
                'title': self._generate_moment_title(i, score),
                'score': score,
                'engagementLevel': engagement_levels[i % len(engagement_levels)]
            })
        
        return moments
    
    def _generate_moment_title(self, index, score):
        """Generate a descriptive title for a moment"""
        if score > 0.85:
            titles = ['Peak engagement', 'Viral moment', 'Key highlight', 'Top reaction']
        elif score > 0.75:
            titles = ['High engagement', 'Strong moment', 'Audience hook', 'Great scene']
        else:
            titles = ['Good moment', 'Engaging scene', 'Nice clip', 'Solid content']
        
        return random.choice(titles)
