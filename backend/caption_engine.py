
import re
import random
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class CaptionEngine:
    def __init__(self):
        self.emoji_map = {
            "happy": "😊", "joy": "😂", "love": "❤️", "video": "📹",
            "cool": "😎", "money": "💰", "wow": "😱", "fire": "🔥",
            "fast": "⚡", "time": "⏳", "cat": "🐱", "dog": "🐶",
            "food": "🍔", "music": "🎵", "game": "🎮"
        }

    def _parse_srt(self, srt_path):
        """Parse SRT file into a list of (start_ms, end_ms, text)"""
        entries = []
        try:
            content = Path(srt_path).read_text(encoding='utf-8')
            blocks = content.strip().split('\n\n')
            for block in blocks:
                lines = block.split('\n')
                if len(lines) >= 3:
                    # Index is lines[0]
                    # Time is lines[1]
                    # Text is lines[2:]
                    time_line = lines[1]
                    text = " ".join(lines[2:])
                    
                    if '-->' in time_line:
                        start_str, end_str = time_line.split('-->')
                        start_ms = self._time_to_ms(start_str.strip())
                        end_ms = self._time_to_ms(end_str.strip())
                        entries.append({
                            'start': start_ms,
                            'end': end_ms,
                            'text': text
                        })
        except Exception as e:
            logger.error(f"Error parsing SRT: {e}")
        return entries

    def _time_to_ms(self, time_str):
        """Convert HH:MM:SS,ms to milliseconds"""
        time_str = time_str.replace(',', '.')
        h, m, s = time_str.split(':')
        s, ms = s.split('.')
        return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)

    def _ms_to_ass_time(self, ms):
        """Convert milliseconds to H:MM:SS.cs format for ASS"""
        h = ms // 3600000
        ms %= 3600000
        m = ms // 60000
        ms %= 60000
        s = ms // 1000
        ms %= 1000
        cs = ms // 10
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def inject_emojis(self, text):
        """Inject random emojis based on keywords"""
        words = text.split()
        new_words = []
        for word in words:
            clean_word = re.sub(r'[^\w]', '', word.lower())
            new_words.append(word)
            if clean_word in self.emoji_map and random.random() > 0.7:
                new_words.append(self.emoji_map[clean_word])
        return " ".join(new_words)

    def generate_ass(self, srt_path, output_path):
        """Convert SRT to ASS with 'Karaoke-lite' highlighting"""
        entries = self._parse_srt(srt_path)
        
        header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,20,20,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        events = []
        for entry in entries:
            start_ass = self._ms_to_ass_time(entry['start'])
            end_ass = self._ms_to_ass_time(entry['end'])
            
            # Simple "Karaoke" -> Highlight current line with color
            # For true word-level we need detailed timestamps which standard SRT lacks.
            # We will use a "Highlight" effect: primary color Yellow then fade to White? 
            # Or just big bold text.
            
            raw_text = entry['text']
            # inject emojis
            text_with_emojis = self.inject_emojis(raw_text)
            
            # ASS Formatting:
            # {\c&H00FFFF&} -> Yellow Color (BGR in hex)
            # We can animate simply by having the text appear with a "pop"
            # {\fad(100,100)} -> fade in/out
            
            # Use 'Pop' animation: Scale up then down?
            # {\t(0,200,\fscx120\fscy120)\t(200,400,\fscx100\fscy100)} 
            
            ass_line = f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{{\\fad(50,50)}}{text_with_emojis}"
            events.append(ass_line)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(header + "\n".join(events))
            
        return output_path
