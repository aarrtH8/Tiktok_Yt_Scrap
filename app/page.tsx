'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';

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
  timestamp: string;
};

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [bestMoments, setBestMoments] = useState([]);
  const [step, setStep] = useState('input'); // input, processing, preview
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(''); // New state to store sessionId
  const [compiledVideoUrl, setCompiledVideoUrl] = useState('');

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

  useEffect(() => {
    if (processingStage === 'idle') return;
    const message = stageMessages[processingStage];
    if (!message) return;

    setActivityLog(prev => {
      if (prev.length && prev[prev.length - 1]?.stage === processingStage) {
        return prev;
      }
      const next = [
        ...prev,
        {
          stage: processingStage,
          label: message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
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
      if (compiledVideoUrl) {
        URL.revokeObjectURL(compiledVideoUrl);
        setCompiledVideoUrl('');
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          const nextValue = Math.min(prev + Math.random() * 18, 95);
          const inferred = deriveStageFromProgress(nextValue);
          setProcessingStage(prevStage =>
            prevStage === inferred ? prevStage : inferred
          );
          return nextValue;
        });
      }, 400);

      // Call video processing API
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/process-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, settings }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to process videos');
      }

      setProcessingStage('finalize');

      const data = await response.json();
      setBestMoments(data.moments);
      setProcessingProgress(100);
      setProcessingStage('completed');
      setIsProcessing(false);
      setStep('preview');
      setSessionId(data.sessionId); // Store sessionId from process response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing videos');
      console.error('[v0] Processing error:', err);
      setIsProcessing(false);
      setStep('input');
      setProcessingStage('error');
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
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="px-4 py-8">
        {error && (
          <div className="mx-auto mb-6 max-w-6xl rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="mx-auto max-w-6xl space-y-8">
          <div className="rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 shadow-lg">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full border border-primary/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                  Studio IA · Beta
                </span>
                <div>
                  <h1 className="text-3xl font-semibold sm:text-4xl">
                    Automatise ta compilation courte en quelques minutes.
                  </h1>
                  <p className="mt-3 text-base text-muted-foreground">
                    Colle des liens YouTube, choisis la durée idéale et laisse l&rsquo;IA détecter
                    les moments forts, ajouter les sous-titres et exporter un fichier prêt pour
                    TikTok.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-3 py-1">
                    Gestion multi-clips
                  </span>
                  <span className="rounded-full border border-border/60 px-3 py-1">
                    Sous-titres optionnels
                  </span>
                  <span className="rounded-full border border-border/60 px-3 py-1">
                    Formats TikTok / Reels
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground lg:max-w-sm">
                <p className="font-medium text-foreground">Comment ça marche ?</p>
                <ol className="mt-3 space-y-2">
                  <li>1. Importer les liens et vérifier les miniatures.</li>
                  <li>2. Sélectionner les réglages (durée, sous-titres, template).</li>
                  <li>3. Lancer la compilation puis télécharger l&rsquo;export final.</li>
                </ol>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {statCards.map(card => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border/60 bg-background/60 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{card.value || '0'}</p>
                  <p className="text-xs text-muted-foreground">{card.helper}</p>
                </div>
              ))}
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
                  className={`rounded-2xl border p-4 ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium uppercase tracking-wide text-muted-foreground">
                      Étape {index + 1}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        isComplete
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                      } text-[10px]`}
                    >
                      {isComplete ? 'OK' : isActive ? 'En cours' : 'À venir'}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold">{stage.title}</p>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[1.9fr,1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Workspace
                  </p>
                  <h2 className="text-xl font-semibold text-foreground">
                    {stageDetails[step]?.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {stageDetails[step]?.helper}
                  </p>
                </div>
                <div className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
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
                    <div className="rounded-xl border border-border bg-muted/40 p-6">
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
                      <div className="mt-4 rounded-xl border border-border bg-black/80 p-2">
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
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Paramètres du rendu
                </p>
                <h2 className="text-xl font-semibold">Compilation & export</h2>
                <p className="text-sm text-muted-foreground">
                  Personnalise la durée, le format et l&rsquo;ajout éventuel de sous-titres avant de
                  lancer le montage automatique.
                </p>
              </div>
              <CompilationSettings
                onGenerate={handleGenerate}
                videosCount={videos.length}
                isProcessing={isProcessing}
              />
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-wide">Pro tip</p>
              <p className="mt-2">
                Ajoute tes meilleurs mots-clés dans le titre final pour booster les vues une fois la
                vidéo exportée. Nous gardons la session ouverte pendant 30 minutes pour permettre
                plusieurs téléchargements.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
