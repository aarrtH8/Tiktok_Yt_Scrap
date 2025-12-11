'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';
import AnimatedBackground from '@/components/animated-background';
import BestPracticesChecklist from '@/components/best-practices';
import {
  computeActivityDuration,
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
  innerTaskId?: string;
  stage: ProcessingStage;
  label: string;
  timestamp?: string;
  startedAt?: string;
  durationMs?: number;
};

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [bestMoments, setBestMoments] = useState<any[]>([]);
  const [step, setStep] = useState('input'); // input, processing, preview
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(''); // New state to store sessionId
  const [compiledVideoUrl, setCompiledVideoUrl] = useState('');
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const [tiktokCaption, setTiktokCaption] = useState('');
  const [reviewMoments, setReviewMoments] = useState<any[]>([]);
  const [hasReviewChanges, setHasReviewChanges] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [settingsSnapshot, setSettingsSnapshot] = useState({
    duration: '30',
    autoDetect: true,
    quality: '1080p',
    includeSubtitles: true,
  });
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  useEffect(() => {
    return () => {
      if (compiledVideoUrl) {
        URL.revokeObjectURL(compiledVideoUrl);
      }
    };
  }, [compiledVideoUrl]);

  const stageMessages: Record<ProcessingStage, string> = useMemo(
    () => ({
      detect: 'Analyse des URLs et récupération des métadonnées.',
      download: 'Téléchargement des vidéos sources en haute qualité.',
      highlights: 'Détection et notation des meilleurs moments.',
      render: 'Adaptation au format vertical et ajout des sous-titres.',
      finalize: 'Assemblage final de la compilation.',
      completed: 'Compilation terminée, prête pour le téléchargement.',
      error: 'Une erreur est survenue durant la compilation.',
      idle: '',
    }),
    []
  );

  const mapServerStageToProcessing = (stageLabel?: string, status?: string): ProcessingStage => {
    if (status === 'queued') return 'detect';
    if (status === 'ready') return 'completed';
    if (status === 'error') return 'error';
    const normalized = stageLabel?.toLowerCase() ?? '';
    if (normalized.includes('téléchargement')) return 'download';
    if (normalized.includes('analyse')) return 'highlights';
    if (normalized.includes('prêt')) return 'render';
    if (normalized.includes('compilation en cours')) return 'finalize';
    if (normalized.includes('compilation terminée')) return 'completed';
    if (normalized.includes('initial')) return 'detect';
    return 'detect';
  };

  const taskStageMap = useMemo<Record<string, ProcessingStage>>(
    () => ({
      download: 'download',
      analyze: 'highlights',
      compile: 'finalize',
    }),
    [],
  );

  useEffect(() => {
    if (processingStage === 'idle') return;
    const message = stageMessages[processingStage];
    if (!message) return;
    const nowIso = new Date().toISOString();
    const isTerminalStage = processingStage === 'completed' || processingStage === 'error';

    setActivityLog(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (lastIndex >= 0) {
        const lastItem = next[lastIndex];
        if (lastItem && !lastItem.innerTaskId && lastItem.startedAt && !lastItem.timestamp) {
          const finalizedDuration = computeActivityDuration({
            startedAt: lastItem.startedAt,
            timestamp: nowIso,
          });
          next[lastIndex] = {
            ...lastItem,
            timestamp: nowIso,
            durationMs: finalizedDuration,
          };
        }
      }

      if (next.length && next[next.length - 1]?.stage === processingStage) {
        return next;
      }

      const newItem: ActivityItem = {
        stage: processingStage,
        label: message,
        startedAt: nowIso,
        timestamp: isTerminalStage ? nowIso : undefined,
        durationMs: isTerminalStage ? 0 : undefined,
      };
      next.push(newItem);
      return next.slice(-7);
    });
  }, [processingStage, stageMessages]);

  const deriveStageFromProgress = (value: number): ProcessingStage => {
    if (value < 20) return 'detect';
    if (value < 55) return 'download';
    if (value < 80) return 'highlights';
    if (value < 95) return 'render';
    return 'finalize';
  };

  useEffect(() => {
    if (step === 'preview' && bestMoments.length) {
      setReviewMoments(bestMoments.map(moment => ({ ...moment, enabled: true })));
      setHasReviewChanges(false);
    }
  }, [bestMoments, step]);


  const handleAddVideos = async (urls: string[]) => {
    try {
      setError('');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/detect-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect videos');
      }

      const data = await response.json();
      setVideos([...videos, ...data.videos]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading videos');
      console.error('[v0] Video detection error:', err);
    }
  };

  const handleRemoveVideo = (id: string) => {
    setVideos(videos.filter(v => v.id !== id));
  };

  const handleGenerate = async (settings: any) => {
    try {
      setError('');
      setIsProcessing(true);
      setStep('processing');
      setProcessingProgress(0);
      setActivityLog([]);
      setProcessingStage('detect');
      setBestMoments([]);
      setSessionId('');
      setTiktokCaption('');
      setQueuePosition(null);
      setIsQueued(true);
      setReviewMoments([]);
      setHasReviewChanges(false);
      setReviewError('');
      setSettingsSnapshot(settings);
      if (compiledVideoUrl) {
        URL.revokeObjectURL(compiledVideoUrl);
        setCompiledVideoUrl('');
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/process-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to process videos');
      }

      const data = await response.json();
      if (!data?.sessionId) {
        throw new Error('Session non initialisée');
      }
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing videos');
      console.error('[v0] Processing error:', err);
      setIsProcessing(false);
      setStep('input');
      setProcessingStage('error');
    }
  };

  useEffect(() => {
    if (!sessionId || !isProcessing) {
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`${API_URL}/api/progress/${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        const data = await response.json();
        if (cancelled) return;

        if (typeof data.progress === 'number') {
          setProcessingProgress(data.progress);
        }

        if (typeof data.queuePosition === 'number') {
          setQueuePosition(data.queuePosition);
        } else {
          setQueuePosition(null);
        }
        setIsQueued(data.status === 'queued');

        const nextStage = mapServerStageToProcessing(data.stage, data.status);
        setProcessingStage(prev => (nextStage ? nextStage : prev));

        if (Array.isArray(data.tasks) && data.tasks.length) {
          setActivityLog(prev => {
            const latest = [...prev];

            const upsertTask = (task: any) => {
              const stageName = taskStageMap[task.id] || 'detect';
              const existingIndex = latest.findIndex(item => item.innerTaskId === task.id);
              const nowIso = new Date().toISOString();
              const startedAtIso =
                task.startedAt || latest[existingIndex]?.startedAt || nowIso;
              const completedAtIso =
                task.completedAt ||
                (task.status === 'done' ? nowIso : latest[existingIndex]?.timestamp);
              let durationMs = task.durationMs;
              if (startedAtIso) {
                const durationReference =
                  completedAtIso || (task.status === 'in_progress' ? nowIso : undefined);
                if (!durationMs && durationReference) {
                  durationMs = computeActivityDuration({
                    startedAt: startedAtIso,
                    timestamp: durationReference,
                  });
                }
              }
              const item: ActivityItem = {
                innerTaskId: task.id,
                stage: stageName,
                label: `${task.label}${task.detail ? ` · ${task.detail}` : ''}`,
                timestamp: completedAtIso,
                startedAt: startedAtIso,
                durationMs,
              };
              if (existingIndex >= 0) {
                latest[existingIndex] = item;
              } else {
                latest.push(item);
              }
            };

            data.tasks.forEach(task => {
              if (task.status === 'pending') return;
              upsertTask(task);
            });
            return latest.slice(-7);
          });
        }

        if (data.tiktokCaption) {
          setTiktokCaption(data.tiktokCaption);
        }

        if (data.status === 'ready') {
          setIsQueued(false);
          setQueuePosition(null);
          setBestMoments(data.moments || []);
          setProcessingProgress(100);
          setProcessingStage('completed');
          setIsProcessing(false);
          setStep('preview');
        } else if (data.status === 'error') {
          setIsQueued(false);
          setError(data.error || 'Erreur pendant la compilation.');
          setProcessingStage('error');
          setIsProcessing(false);
          setStep('input');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[v0] Progress polling error:', err);
        }
      }
    };

    fetchProgress();
    const intervalId = setInterval(fetchProgress, 2000);
    progressPollRef.current = intervalId;

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      progressPollRef.current = null;
    };
  }, [sessionId, isProcessing, taskStageMap]);

  useEffect(() => {
    if (step === 'preview' && bestMoments.length) {
      setReviewMoments(bestMoments.map(moment => ({ ...moment, enabled: true })));
      setHasReviewChanges(false);
    }
  }, [bestMoments, step]);

  const moveReviewMoment = (id: string, direction: 'up' | 'down') => {
    setReviewMoments(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, removed);
      setHasReviewChanges(true);
      return updated;
    });
  };

  const toggleReviewMoment = (id: string) => {
    setReviewMoments(prev => {
      const updated = prev.map(moment =>
        moment.id === id ? { ...moment, enabled: !moment.enabled } : moment
      );
      setHasReviewChanges(true);
      return updated;
    });
  };

  const saveReviewOrder = async () => {
    try {
      setReviewError('');
      const enabledIds = reviewMoments.filter(m => m.enabled).map(m => m.id);
      if (!enabledIds.length) {
        setReviewError('Sélectionne au moins un moment à conserver.');
        return;
      }
      if (!sessionId) {
        setReviewError('Session introuvable.');
        return;
      }
      setIsSavingReview(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/moments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: enabledIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Impossible de sauvegarder l’ordre.');
      }
      const payload = await response.json();
      setBestMoments(payload.moments ?? []);
      setReviewMoments((payload.moments ?? []).map(moment => ({ ...moment, enabled: true })));
      if (payload.tiktokCaption) {
        setTiktokCaption(payload.tiktokCaption);
      }
      setHasReviewChanges(false);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleDownload = async (quality: string) => {
    try {
      setError('');
      if (!sessionId) {
        throw new Error('Aucune session active. Relance la compilation.');
      }
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/download-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionId, // Store sessionId from process response
          quality 
        }),
      });

      if (!response.ok) {
        let message = 'Failed to download video';
        const raw = await response.text().catch(() => '');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.error) {
              message = parsed.error;
            } else {
              message = raw;
            }
          } catch {
            message = raw;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      setCompiledVideoUrl(prev => {
        if (prev) {
          window.URL.revokeObjectURL(prev);
        }
        return url;
      });

      const a = document.createElement('a');
      a.href = url;
      a.download = 'tiktok-compilation.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error downloading video');
      console.error('[v0] Download error:', err);
    }
  };

  const canDownload = step === 'preview' && Boolean(sessionId);
  const reviewComplete = step === 'preview' && reviewMoments.length > 0 && !hasReviewChanges;
  const captionReady = Boolean(tiktokCaption);

  const stageDetails: Record<
    string,
    { title: string; description: string; helper: string }
  > = {
    input: {
      title: 'Collecte des sources',
      description: 'Colle les liens YouTube ou TikTok à compiler.',
      helper: 'Ajoute au moins un lien pour déverrouiller le montage.',
    },
    processing: {
      title: 'Analyse & montage',
      description: 'Nous extrayons automatiquement les meilleurs moments.',
      helper: 'La progression est mise à jour en direct.',
    },
    preview: {
      title: 'Prévisualisation & export',
      description: 'Contrôle les moments retenus puis exporte ta vidéo.',
      helper: 'Télécharge un export MP4 optimisé pour TikTok.',
    },
  };

  const stageOrder = ['input', 'processing', 'preview'];
  const activeStageIndex = stageOrder.indexOf(step);
  const statCards = [
    {
      label: 'Clips importés',
      value: videos.length,
      helper: videos.length ? 'Prêts à être montés' : 'En attente de liens',
    },
    {
      label: 'Étape en cours',
      value: stageDetails[step]?.title ?? 'Préparation',
      helper: stageDetails[step]?.description ?? 'Configure ton projet',
    },
    {
      label: 'Session',
      value: sessionId ? sessionId.slice(0, 6) : 'À créer',
      helper: sessionId ? 'Session active' : 'Lancera au traitement',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-background to-background text-foreground">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
        {error && (
          <div className="mx-auto mb-6 max-w-4xl rounded-3xl border border-destructive/40 bg-destructive/15 p-4 text-sm text-destructive shadow-lg shadow-destructive/20 backdrop-blur">
            {error}
          </div>
        )}

        <section className="space-y-10">
          <div className="glass-panel shine-border relative overflow-hidden rounded-[32px] border border-white/10 p-8 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-primary/30 via-transparent to-transparent opacity-60 blur-3xl" />

            <div className="grid gap-10 lg:grid-cols-[1.6fr,1fr]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/80">
                    Studio IA
                  </span>
                  <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 px-3 py-1 text-[10px] text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Monitoring en direct
                  </span>
                </div>
                <div className="space-y-4">
                  <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    Automatise ta compilation courte avec une{' '}
                    <span className="text-transparent bg-gradient-to-r from-sky-300 via-primary-foreground/90 to-fuchsia-300 bg-clip-text">
                      expérience ultra fluide
                    </span>
                    .
                  </h1>
                  <p className="text-base text-white/70">
                    Colle tes URLs, règle la durée et laisse l’IA détecter les moments forts, incruster
                    les sous-titres et exporter un master 9:16 prêt pour TikTok, Reels et Shorts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-white/80">
                  {['Gestion multi-clips', 'Sous-titres optionnels', 'Templates verticales'].map(label => (
                    <span
                      key={label}
                      className="rounded-full border border-white/15 px-3 py-1 backdrop-blur"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {statCards.map(card => (
                    <div
                      key={card.label}
                      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80 shadow-lg shadow-primary/5 transition hover:-translate-y-1 hover:border-primary/40"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-white/60">{card.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{card.value || '0'}</p>
                      <p className="text-xs text-white/70">{card.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel relative rounded-[28px] border border-white/10 p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
                    Pipeline
                  </p>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {processingStage === 'completed' ? 'Prêt à exporter' : 'Actif'}
                  </div>
                </div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white">{stageDetails[step]?.title}</p>
                  <p className="text-xs text-white/70">{stageDetails[step]?.description}</p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-sky-300 to-fuchsia-400 transition-all"
                      style={{ width: `${Math.max(12, processingProgress)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {activityLog.length > 0 ? (
                    activityLog.map((item, idx) => (
                      <div
                        key={item.innerTaskId ?? `${item.stage}-${item.startedAt ?? idx}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/70"
                      >
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-[11px] uppercase tracking-wide text-white/50">
                            {item.stage}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-white/60">
                          <p>Début · {formatActivityTime(item.startedAt)}</p>
                          <p>Fin · {formatActivityTime(item.timestamp)}</p>
                          <p>Durée · {formatActivityDuration(item)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/60">
                      Les étapes en cours s’afficheront ici dès que la compilation sera lancée.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {stageOrder.map((stageKey, index) => {
              const isActive = step === stageKey;
              const isComplete = index < activeStageIndex;
              const stage = stageDetails[stageKey];

              return (
                <div
                  key={stageKey}
                  className={`relative overflow-hidden rounded-3xl border p-5 transition ${
                    isActive
                      ? 'border-primary/40 bg-white/10 shadow-xl shadow-primary/20'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.4em] text-white/50">
                    <span>Étape {index + 1}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        isComplete
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : isActive
                            ? 'bg-primary/20 text-primary-foreground/80'
                            : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {isComplete ? 'Terminé' : isActive ? 'En cours' : 'À venir'}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-white">{stage.title}</p>
                  <p className="text-sm text-white/70">{stage.description}</p>
                  <p className="mt-2 text-xs text-white/50">{stage.helper}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.8fr,1fr]">
          <div className="space-y-6">
            <div className="glass-panel rounded-[28px] border border-white/10 p-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">Workspace</p>
                  <h2 className="text-2xl font-semibold text-white">{stageDetails[step]?.title}</h2>
                  <p className="text-sm text-white/70">{stageDetails[step]?.helper}</p>
                </div>
                <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70">
                  {videos.length} clip{videos.length > 1 ? 's' : ''} importé
                  {videos.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="pt-6">
                {step === 'input' && (
                  <div className="space-y-6">
                    <URLInput onAddVideos={handleAddVideos} />
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                      Ajoute des liens YouTube (un par ligne) puis clique sur
                      &laquo;&nbsp;Ajouter les vidéos&nbsp;&raquo;. Tu peux vérifier chaque clip
                      dans la liste avant de lancer le montage.
                    </div>
                    {videos.length > 0 && (
                      <VideoPreview videos={videos} onRemoveVideo={handleRemoveVideo} />
                    )}
                  </div>
                )}

                {step === 'processing' && (
                  <div className="rounded-xl border border-border bg-background/70 p-4">
                    {isQueued && queuePosition && (
                      <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        File en attente · position {queuePosition}. La compilation démarre automatiquement.
                      </div>
                    )}
                    <ProcessingInterface
                      progress={processingProgress}
                      moments={bestMoments}
                      stage={processingStage}
                      activityLog={activityLog}
                    />
                  </div>
                )}

                {step === 'preview' && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <ProcessingInterface
                        progress={100}
                        moments={bestMoments}
                        onDownload={canDownload ? handleDownload : undefined}
                        stage={processingStage}
                        activityLog={activityLog}
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">Résultat final</h3>
                          <p className="text-sm text-muted-foreground">
                            Prévisualise la compilation avant téléchargement.
                          </p>
                        </div>
                        {canDownload && (
                          <span className="text-xs font-medium uppercase tracking-wide text-primary">
                            Session prête · {sessionId.slice(0, 6)}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border border-border bg-black/80 p-2">
                        {compiledVideoUrl ? (
                          <video
                            key={compiledVideoUrl}
                            controls
                            className="w-full rounded-lg border border-border bg-black"
                          >
                            <source src={compiledVideoUrl} type="video/mp4" />
                            Votre navigateur ne supporte pas la lecture vidéo.
                          </video>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/60 px-6 py-16 text-center">
                            <p className="text-sm text-muted-foreground">
                              {canDownload
                                ? 'Clique sur “Download Video” pour générer la prévisualisation.'
                                : 'La prévisualisation apparaîtra juste après la compilation.'}
                            </p>
                            {!canDownload && (
                              <p className="mt-2 text-xs text-muted-foreground/80">
                                Assure-toi que la compilation est terminée puis relance le
                                téléchargement.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    {tiktokCaption && (
                      <div className="rounded-xl border border-border bg-background/70 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Description TikTok suggérée</p>
                              <p className="text-xs text-muted-foreground">
                                Copie-la et ajoute tes hashtags favoris avant publication.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(tiktokCaption).catch(() => undefined)}
                              className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary transition hover:border-primary/50 hover:text-primary/80"
                            >
                              Copier
                            </button>
                          </div>
                          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">
                            {tiktokCaption}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-[28px] border border-white/10 p-6 shadow-2xl">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                  Paramètres du rendu
                </p>
                <h2 className="text-xl font-semibold text-white">Compilation & export</h2>
                <p className="text-sm text-white/70">
                  Personnalise la durée, le format et l&rsquo;ajout éventuel de sous-titres avant de
                  lancer le montage automatique.
                </p>
              </div>
              <CompilationSettings
                onGenerate={handleGenerate}
                onSettingsChange={setSettingsSnapshot}
                videosCount={videos.length}
                isProcessing={isProcessing}
              />
            </div>
            <div className="glass-panel rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/5 to-transparent p-5 text-sm text-white/80 shadow-lg shadow-primary/10">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Pro tip</p>
              <p className="mt-2 text-white/80">
                Ajoute tes meilleurs mots-clés dans le titre final pour booster les vues une fois la
                vidéo exportée. Nous gardons la session ouverte pendant 30 minutes pour permettre
                plusieurs téléchargements.
              </p>
            </div>
            <BestPracticesChecklist
              videosCount={videos.length}
              settings={settingsSnapshot}
              step={step}
              reviewComplete={reviewComplete}
              captionReady={captionReady}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
