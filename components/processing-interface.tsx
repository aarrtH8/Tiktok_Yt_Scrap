import {
  CheckCircle,
  Play,
  Download,
  Video,
  Loader,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import {
  formatActivityDuration,
  formatActivityTime,
} from '@/lib/activity-log';

type ProcessingStage =
  | 'idle'
  | 'detect'
  | 'download'
  | 'highlights'
  | 'render'
  | 'finalize'
  | 'completed'
  | 'error';

type ActivityItem = {
  stage: ProcessingStage;
  label: string;
  timestamp?: string;
  startedAt?: string;
  durationMs?: number;
};

type ProcessingProps = {
  progress: number;
  moments?: any[];
  onDownload?: (quality: string) => Promise<void> | void;
  stage?: ProcessingStage;
  activityLog?: ActivityItem[];
};

const PROCESS_STEPS: Array<{
  id: ProcessingStage;
  label: string;
  description: string;
}> = [
  {
    id: 'detect',
    label: 'Analyse',
    description: 'Lecture des liens et récupération des métadonnées.',
  },
  {
    id: 'download',
    label: 'Téléchargement',
    description: 'Récupération des fichiers sources en HD.',
  },
  {
    id: 'highlights',
    label: 'Moments forts',
    description: 'Détection des séquences avec le plus d’engagement.',
  },
  {
    id: 'render',
    label: 'Rendu vertical',
    description: 'Adaptation 9:16, sous-titres et transitions.',
  },
  {
    id: 'finalize',
    label: 'Assemblage',
    description: 'Concaténation finale et préparation de l’export.',
  },
];

export default function ProcessingInterface({
  progress,
  moments = [],
  onDownload,
  stage = 'idle',
  activityLog = [],
}: ProcessingProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const hasMoments = Array.isArray(moments) && moments.length > 0;
  const showExportOptions = typeof onDownload === 'function';
  const stageOrder = PROCESS_STEPS.map(step => step.id);
  const stageIndex =
    stage === 'completed'
      ? PROCESS_STEPS.length
      : Math.max(stageOrder.indexOf(stage), 0);
  const isErrored = stage === 'error';
  const currentStep =
    PROCESS_STEPS.find(step => step.id === stage) ??
    PROCESS_STEPS[PROCESS_STEPS.length - 1];

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

  const progressValue = isDownloading ? downloadProgress : progress;
  const progressLabel = isDownloading
    ? hasMoments
      ? `Création du master final (${Math.min(
          Math.ceil((downloadProgress / 100) * moments.length),
          moments.length
        )}/${moments.length})`
      : 'Préparation de la vidéo...'
    : isErrored
    ? 'Une erreur est survenue. Consulte les détails et réessaie.'
    : stage === 'completed'
    ? 'Compilation terminée, prête à être téléchargée.'
    : currentStep?.description ?? 'Préparation en cours...';

  const barClassName = isErrored
    ? 'h-full bg-destructive transition-all duration-300'
    : 'h-full bg-gradient-to-r from-primary to-accent transition-all duration-300';

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
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isComplete
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
                  key={item.timestamp ? `${item.stage}-${item.timestamp}-${idx}` : `${item.stage}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.stage}</p>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <p>Début · {formatActivityTime(item.startedAt)}</p>
                    <p>Fin · {formatActivityTime(item.timestamp)}</p>
                    <p>Durée · {formatActivityDuration(item)}</p>
                  </div>
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
