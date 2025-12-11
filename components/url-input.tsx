'use client';

import { useState } from 'react';
import { Plus, Youtube, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface URLInputProps {
  onAddVideos: (urls: string[]) => void;
}

export default function URLInput({ onAddVideos }: URLInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      const urls = input
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length > 0) {
        onAddVideos(urls);
        setInput('');
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <div className={`
          relative flex items-center gap-3 p-2 bg-card border rounded-2xl transition-all duration-300
          ${isFocused ? 'border-primary/50 shadow-[0_0_30px_-5px_var(--primary)] bg-accent/5' : 'border-border hover:border-primary/30'}
        `}>
          <div className="pl-4">
            <LinkIcon className={`w-5 h-5 transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Entrez vos liens YouTube ici..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground text-lg py-3"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="p-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-0 disabled:scale-95 transition-all duration-300"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Helper text with fade in */}
        <AnimatePresence>
          {isFocused && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -bottom-8 left-4 text-xs text-muted-foreground"
            >
              Appuyez sur Entrée pour ajouter
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
