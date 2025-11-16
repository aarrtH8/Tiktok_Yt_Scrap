'use client';

import { useState } from 'react';
import { Upload, Plus } from 'lucide-react';

export default function URLInput({ onAddVideos }) {
  const [input, setInput] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = (e) => {
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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      setInput(prev => prev ? prev + '\n' + text : text);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <h2 className="text-xl font-semibold mb-4">Add YouTube Videos</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Paste YouTube URLs</p>
            <p className="text-xs text-muted-foreground">One URL per line</p>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://youtube.com/watch?v=...&#10;https://youtube.com/watch?v=..."
            className="w-full px-4 py-3 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            rows={4}
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Videos
          </button>
        </form>
      </div>
    </div>
  );
}
