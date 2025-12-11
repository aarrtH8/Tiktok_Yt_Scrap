'use client';

import { useEffect, useState } from 'react';
import { Settings, Sparkles, Wand2 } from 'lucide-react';

const TEMPLATES = [
  {
    id: 'default',
    label: 'Standard',
    description: 'Équilibre clips et sous-titres pour la majorité des contenus.',
    duration: '30',
    quality: '1080p',
    includeSubtitles: true,
  },
  {
    id: 'podcast',
    label: 'Podcast punchy',
    description: 'Clips plus longs, sous-titres activés, parfait pour interviews.',
    duration: '60',
    quality: '1080p',
    includeSubtitles: true,
  },
  {
    id: 'reaction',
    label: 'Réaction rapide',
    description: 'Clips courts, sous-titres facultatifs, idéal pour gaming.',
    duration: '20',
    quality: '720p',
    includeSubtitles: false,
  },
];

type SettingsState = {
  duration: string;
  autoDetect: boolean;
  quality: string;
  includeSubtitles: boolean;
};

type Props = {
  onGenerate: (settings: SettingsState) => void;
  onSettingsChange?: (settings: SettingsState) => void;
  videosCount: number;
  isProcessing: boolean;
};

export default function CompilationSettings({ onGenerate, onSettingsChange, videosCount, isProcessing }: Props) {
  const [duration, setDuration] = useState('30');
  const [autoDetect, setAutoDetect] = useState(true);
  const [quality, setQuality] = useState('1080p');
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('default');

  useEffect(() => {
    onSettingsChange?.({
      duration,
      autoDetect,
      quality,
      includeSubtitles,
    });
  }, [duration, autoDetect, quality, includeSubtitles, onSettingsChange]);

  const applyTemplate = templateId => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setDuration(template.duration);
    setQuality(template.quality);
    setIncludeSubtitles(template.includeSubtitles);
  };

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

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wand2 className="w-4 h-4 text-accent" />
            Templates IA
          </div>
          <div className="space-y-2">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{template.label}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
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
