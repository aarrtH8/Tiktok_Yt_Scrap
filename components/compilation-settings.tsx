'use client';

import { useState } from 'react';
import { Settings, Sparkles } from 'lucide-react';

export default function CompilationSettings({ onGenerate, videosCount, isProcessing }) {
  const [duration, setDuration] = useState('30');
  const [autoDetect, setAutoDetect] = useState(true);
  const [quality, setQuality] = useState('1080p');
  const [includeSubtitles, setIncludeSubtitles] = useState(true);


  const handleGenerate = () => {
    onGenerate({
      duration,
      autoDetect,
      quality,
      includeSubtitles,
    });
  };

  return (
    <div className="space-y-4 sticky top-24">
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Settings</h3>
        </div>

        {/* Duration Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Output Duration</label>
          <div className="grid grid-cols-2 gap-2">
            {['15', '30', '60'].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  duration === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
          <input
            type="range"
            min="15"
            max="180"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">Custom: {duration}s</p>
        </div>

        {/* Auto-detect Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <label className="text-sm font-medium">Auto-detect Best Moments</label>
          </div>
          <button
            onClick={() => setAutoDetect(!autoDetect)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              autoDetect ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                autoDetect ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>

        {/* Subtitle Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sous-titres</span>
            <span className="text-xs text-muted-foreground">(optionnel)</span>
          </div>
          <button
            onClick={() => setIncludeSubtitles(!includeSubtitles)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              includeSubtitles ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                includeSubtitles ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>


        {/* Quality Settings */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quality</label>
          <div className="space-y-2">
            {['720p', '1080p'].map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`w-full py-2 px-3 rounded-lg text-sm transition-all text-left ${
                  quality === q
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={videosCount === 0 || isProcessing}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-3 rounded-lg transition-all"
        >
          {isProcessing ? 'Processing...' : 'Generate TikTok Video'}
        </button>
      </div>
    </div>
  );
}
