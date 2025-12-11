'use client';

import { useState } from 'react';
import { Settings, Sparkles, Hash, Type, Clock, Check, Layout } from 'lucide-react';
import { motion } from 'framer-motion';

interface CompilationSettingsProps {
  onGenerate: (settings: any) => void;
  videosCount: number;
  isProcessing: boolean;
}

export default function CompilationSettings({ onGenerate, videosCount, isProcessing }: CompilationSettingsProps) {
  const [duration, setDuration] = useState('30');
  const [layout, setLayout] = useState('crop');
  const [headerText, setHeaderText] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [quality, setQuality] = useState('1080p');
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [captionStyle, setCaptionStyle] = useState('engaging');
  const [hashtags, setHashtags] = useState(true);

  const captionStyles = [
    { id: 'engaging', label: 'Engaging', icon: '😱', desc: 'Clickbait & Viral' },
    { id: 'punchy', label: 'Punchy', icon: '💥', desc: 'Short & Impactful' },
    { id: 'professional', label: 'Pro', icon: '👔', desc: 'Clean & Informative' },
    { id: 'minimal', label: 'Minimal', icon: '✨', desc: 'Just the Title' },
    { id: 'animals', label: 'Animals', icon: '🐾', desc: 'Cute & Funny' },
  ];

  const handleGenerate = () => {
    onGenerate({
      duration,
      autoDetect,
      quality,
      includeSubtitles,
      captionStyle,
      hashtags,
      layout,
      headerText
    });
  };

  return (
    <div className="space-y-6 sticky top-24">
      <div className="glass-panel border border-border rounded-[28px] p-6 space-y-8 shadow-2xl relative overflow-hidden bg-card/40 backdrop-blur-xl">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex items-center gap-3 relative">
          <div className="p-2 rounded-xl bg-accent border border-border">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">Studio Controls</h3>
            <p className="text-xs text-muted-foreground">Customize your output</p>
          </div>
        </div>

        {/* Caption Style */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Type className="w-3 h-3" /> Caption Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {captionStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => setCaptionStyle(style.id)}
                className={`group relative p-3 rounded-xl border text-left transition-all duration-300 ${captionStyle === style.id
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xl">{style.icon}</span>
                  {captionStyle === style.id && (
                    <motion.div
                      layoutId="check"
                      className="bg-primary rounded-full p-0.5"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </div>
                <div className="font-medium text-sm">{style.label}</div>
                <div className="text-[10px] opacity-70">{style.desc}</div>
              </button>
            ))}
          </div>
          {/* Hashtags Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border mt-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground/80">Smart Hashtags</span>
            </div>
            <button
              onClick={() => setHashtags(!hashtags)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 ${hashtags ? 'bg-primary' : 'bg-muted'
                }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-background rounded-full shadow-md"
                animate={{ x: hashtags ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Duration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-3 h-3" /> Duration (seconds)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="300"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-16 bg-background border border-border rounded-lg px-2 py-1 text-right text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>
          </div>

          <div className="relative pt-2 pb-2">
            <input
              type="range"
              min="10"
              max="180"
              step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between mt-2 text-xs font-medium text-muted-foreground">
              <span>10s</span>
              <span>90s</span>
              <span>180s</span>
            </div>
          </div>
        </div>

        {/* Layout Style */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layout className="w-3 h-3" /> Layout Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'crop', label: 'Smart Crop', icon: '🔍', desc: 'Auto-detect active area' },
              { id: 'fit', label: 'Fit & Blur', icon: '📱', desc: 'No crop · Blurred margins' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setLayout(option.id)}
                className={`relative px-3 py-3 rounded-xl border transition-all text-left ${layout === option.id
                  ? 'bg-primary/10 border-primary/50 text-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent hover:border-border'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{option.icon}</span>
                  <span className={`text-xs font-medium ${layout === option.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {option.label}
                  </span>
                </div>
                <div className="text-[10px] opacity-70 leading-tight pl-6">
                  {option.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Header Title (Optional) */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Type className="w-3 h-3" /> Hook Title (Optional)
          </label>
          <input
            type="text"
            placeholder="Ex: WAIT FOR IT 😱"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {/* Auto-detect */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${autoDetect ? 'bg-amber-500/10 text-amber-500' : 'bg-secondary text-muted-foreground'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">AI Highlights</div>
                <div className="text-xs text-muted-foreground">Auto-detect best moments</div>
              </div>
            </div>
            <button
              onClick={() => setAutoDetect(!autoDetect)}
              className={`relative w-10 h-6 rounded-full transition-colors ${autoDetect ? 'bg-primary' : 'bg-muted'
                }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-background rounded-full"
                animate={{ x: autoDetect ? 16 : 0 }}
              />
            </button>
          </div>

          {/* Subtitles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${includeSubtitles ? 'bg-blue-500/10 text-blue-500' : 'bg-secondary text-muted-foreground'}`}>
                <Type className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Auto Subtitles</div>
                <div className="text-xs text-muted-foreground">Burn-in captions</div>
              </div>
            </div>
            <button
              onClick={() => setIncludeSubtitles(!includeSubtitles)}
              className={`relative w-10 h-6 rounded-full transition-colors ${includeSubtitles ? 'bg-primary' : 'bg-muted'
                }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-background rounded-full"
                animate={{ x: includeSubtitles ? 16 : 0 }}
              />
            </button>
          </div>
        </div>


        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={videosCount === 0 || isProcessing}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 p-[1px] shadow-2xl transition-all hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="relative flex items-center justify-center gap-2 rounded-xl bg-background/90 px-4 py-4 transition-all group-hover:bg-background/0">
            <span className="font-bold text-foreground group-hover:text-white transition-colors group-hover:scale-105 transform duration-200">
              {isProcessing ? 'Creating Magic...' : 'Generate Video 🚀'}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
