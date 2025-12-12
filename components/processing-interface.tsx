import AudioVisualizer from '@/components/audio-visualizer';

import { Loader, AlertTriangle, CheckCircle, Clock, Video, Play, Download, Check } from 'lucide-react';

interface ProcessingProps {
  progress: number;
  moments?: any[];
  onDownload?: (quality: string) => void;
  stage?: 'idle' | 'detect' | 'download' | 'highlights' | 'render' | 'finalize' | 'completed' | 'error';
  activityLog?: any[];
}

export default function ProcessingInterface({
  progress,
  moments = [],
  onDownload,
  stage = 'idle',
  activityLog = [],
}: ProcessingProps) {
  // ... (existing state)

  // Show visualizer during active analysis phases
  const showVisualizer = stage === 'detect' || stage === 'highlights' || stage === 'download';

  const isDownloading = stage === 'download';
  const isErrored = stage === 'error';
  const progressValue = progress;

  const PROCESS_STEPS = [
    { id: 'detect', label: 'Analysis', description: 'Parsing URL & Metadata' },
    { id: 'download', label: 'Download', description: 'Fetching High-Res Source' },
    { id: 'highlights', label: 'AI Detection', description: 'Finding Best Moments' },
    { id: 'render', label: 'Processing', description: 'Cropping & Subtitling' },
    { id: 'finalize', label: 'Compilation', description: 'Stitching Final Video' },
  ];

  const stageIndex = PROCESS_STEPS.findIndex(s => s.id === stage);
  const progressLabel = stage === 'idle' ? 'Ready' : (PROCESS_STEPS[stageIndex]?.label || 'Processing...');
  const hasMoments = moments.length > 0;

  // Mock download progress for visualizer if not separate
  const downloadProgress = isDownloading ? progress : 0;

  const barClassName = `h-full transition-all duration-500 ease-out rounded-full ${isErrored ? 'bg-destructive' : 'bg-primary'
    }`;

  // Fix ReferenceError: define showExportOptions and handler
  const showExportOptions = stage === 'completed';
  const handleDownloadWithProgress = (quality: string) => {
    if (onDownload) onDownload(quality);
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar & Visualizer */}
      <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        {/* Background Visualizer Overlay */}
        {showVisualizer && (
          <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
            <AudioVisualizer isActive={true} barCount={40} color="rgb(168, 85, 247)" />
          </div>
        )}

        <div className="relative z-10 mb-4">
          <div className="flex items-center justify-between mb-2">
  // ... (rest of the component)
            <h3 className="font-semibold">
              {isDownloading ? 'Download Progress' : 'Compilation Progress'}
            </h3>
            <span className="text-sm text-muted-foreground">
              {Math.round(progressValue)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={barClassName}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isErrored ? (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          ) : (
            <Loader className="w-4 h-4 animate-spin text-primary/70" />
          )}
          <p>{progressLabel}</p>
        </div>
      </div>

      {/* Stage overview & activity log */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">Pipeline de compilation</h4>
          <div className="space-y-3">
            {PROCESS_STEPS.map((step, idx) => {
              const isComplete = stageIndex > idx;
              const isCurrent = stageIndex === idx && !isErrored && stage !== 'completed';
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-3 rounded-lg border border-border/70 p-3 bg-muted/40"
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isComplete
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}
                  >
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Journal en temps réel</h4>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          {activityLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Les mises à jour en direct apparaîtront ici pendant la compilation.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activityLog.map((item, idx) => (
                <li
                  key={`${item.stage}-${item.timestamp}-${idx}`}
                  className="flex items-start justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.stage}</p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{item.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Best Moments List */}
      {hasMoments && (
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
      {showExportOptions && (
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
