import { X, Play, Clock } from 'lucide-react';
import Image from 'next/image';

export default function VideoPreview({ videos, onRemoveVideo }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Imported Videos</h3>
        <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-medium rounded-full">
          {videos.length} video{videos.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {videos.map((video) => (
          <div key={video.id} className="flex gap-4 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors group">
            <div className="relative flex-shrink-0 w-24 h-16 bg-background rounded-md overflow-hidden">
              <img
                src={video.thumbnail || "/placeholder.svg"}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Play className="w-5 h-5 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{video.title}</p>
              <p className="text-xs text-muted-foreground">{video.channel}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </span>
              </div>
            </div>

            <button
              onClick={() => onRemoveVideo(video.id)}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
