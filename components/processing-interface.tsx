import { CheckCircle, Play, Download, Video, Loader, Clock, PauseCircle } from 'lucide-react';
import { useState } from 'react';

type Task = {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'done';
  progress?: number;
  detail?: string;
  etaSeconds?: number | null;
};

type Props = {
  progress: number;
  moments: any[];
  onDownload?: (quality: string) => Promise<void> | void;
  statusLabel?: string;
  tasks?: Task[];
  isProcessing?: boolean;
  totalEtaSeconds?: number;
};

const formatSeconds = (s?: number | null) => {
  if (s === null || s === undefined) return '';
  if (s < 60) return `${Math.max(1, Math.round(s))}s`;
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}m${secs.toString().padStart(2, '0')}s`;
};

export default function ProcessingInterface({ progress, moments, onDownload, statusLabel, tasks = [], isProcessing = false, totalEtaSeconds }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownloadWithProgress = async (quality: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulate progressive download
      const downloadInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 95) {
            clearInterval(downloadInterval);
            return 95;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      await onDownload?.(quality);

      clearInterval(downloadInterval);
      setDownloadProgress(100);
      
      // Reset after completion
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1000);
    } catch (err) {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">
              {isDownloading ? 'Download Progress' : 'Compilation Progress'}
            </h3>
            <span className="text-sm text-muted-foreground">
              {Math.round(isDownloading ? downloadProgress : progress)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
              style={{ width: `${isDownloading ? downloadProgress : progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isDownloading
              ? `Ajout du moment ${Math.ceil((downloadProgress / 100) * moments.length)} / ${moments.length}`
              : progress < 100
              ? statusLabel || 'Analyse en cours...'
              : 'Compilation terminée'}
          </span>
          <span className="flex items-center gap-2">
            {isProcessing && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Temps réel
              </span>
            )}
            {totalEtaSeconds !== undefined && totalEtaSeconds !== null && !isDownloading && (
              <span className="text-foreground">ETA totale {formatSeconds(totalEtaSeconds)}</span>
            )}
          </span>
        </div>
      </div>

      {/* Task details */}
      {tasks.length > 0 && (
        <div className="bg-muted/60 border border-border/60 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <p className="font-semibold">Étapes en cours</p>
            {totalEtaSeconds !== undefined && totalEtaSeconds !== null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> ETA totale {formatSeconds(totalEtaSeconds)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {task.status === 'done' ? (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  ) : task.status === 'in_progress' ? (
                    <Loader className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <PauseCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-foreground">{task.label}</span>
                    {task.detail && (
                      <span className="text-xs text-muted-foreground">{task.detail}</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    {task.status === 'done'
                      ? 'Terminé'
                      : task.status === 'in_progress'
                      ? 'En cours'
                      : 'En attente'}
                  </p>
                  {typeof task.progress === 'number' && (
                    <p className="mt-1">{Math.round(task.progress)}%</p>
                  )}
                  {task.status === 'in_progress' && task.etaSeconds !== undefined && task.etaSeconds !== null && (
                    <p className="mt-1">ETA {formatSeconds(task.etaSeconds)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Moments List */}
      {moments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Detected Best Moments ({moments.length})
          </h3>
          <div className="space-y-3">
            {moments.map((moment, idx) => (
              <div
                key={idx}
                className="p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors group border border-border/50"
                style={{
                  opacity: isDownloading ? (idx < Math.ceil((downloadProgress / 100) * moments.length) ? 1 : 0.5) : 1,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {isDownloading && idx < Math.ceil((downloadProgress / 100) * moments.length) ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{moment.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {moment.timestamp} • {moment.duration}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Video className="w-3 h-3" />
                        <span className="truncate">{moment.videoTitle}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button className="p-2 bg-primary/20 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4" />
                    </button>
                    <div className="text-right">
                      <p className="text-xs font-medium text-primary">
                        {moment.engagementLevel || 'High Quality'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview and Export */}
      {moments.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Export Options</h3>
          <div className="space-y-3">
            <button
              onClick={() => handleDownloadWithProgress('1080p')}
              disabled={isDownloading}
              className="w-full bg-gradient-to-r from-secondary to-orange-500 hover:opacity-90 disabled:opacity-50 text-secondary-foreground font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isDownloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isDownloading ? 'Generating...' : 'Download Video (1080p)'}
            </button>
            <button
              onClick={() => handleDownloadWithProgress('720p')}
              disabled={isDownloading}
              className="w-full bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isDownloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isDownloading ? 'Generating...' : 'Download Video (720p)'}
            </button>
            <label className="flex items-center gap-2 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors">
              <input type="checkbox" className="w-4 h-4" defaultChecked disabled={isDownloading} />
              <span className="text-sm">Add captions/subtitles</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
