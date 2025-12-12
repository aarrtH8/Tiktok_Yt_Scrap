'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';
import AnimatedBackground from '@/components/animated-background';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

import TimelineEditor from '@/components/timeline-editor';
import MagneticButton from '@/components/ui/magnetic-button';
import ConfettiSideCannons from '@/components/ui/confetti';

// Dynamically import the 3D Mascot so it only loads on client
const HeroMascot = dynamic(() => import('@/components/hero-mascot'), { ssr: false });

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
  const [videos, setVideos] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [bestMoments, setBestMoments] = useState<any[]>([]);
  const [videoDurations, setVideoDurations] = useState<number[]>([]);
  const [step, setStep] = useState('input'); // input, processing, editor, preview
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(''); // New state to store sessionId
  const [compiledVideoUrl, setCompiledVideoUrl] = useState('');
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const [tiktokCaption, setTiktokCaption] = useState('');
  const [compilationSettings, setCompilationSettings] = useState<any>(null);

  // Parallax Hooks
  const { scrollYProgress } = useScroll();
  const yText = useTransform(scrollYProgress, [0, 0.5], [0, 200]);
  const yMascot = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

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

  const taskStageMap: Record<string, ProcessingStage> = {
    download: 'download',
    analyze: 'highlights',
    compile: 'finalize',
  };

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
      setCompilationSettings(settings);
      setProcessingProgress(0);
      setActivityLog([]);
      setProcessingStage('detect');
      setBestMoments([]);
      setSessionId('');
      setTiktokCaption('');
      if (compiledVideoUrl) {
        URL.revokeObjectURL(compiledVideoUrl);
        setCompiledVideoUrl('');
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      // Use the new analyze endpoint
      const response = await fetch(`${API_URL}/api/analyze-moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
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

  const handleEditorConfirm = async (updatedMoments: any[]) => {
    try {
      setIsProcessing(true);
      setStep('processing');
      setBestMoments(updatedMoments); // Update local state

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/compile-final`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          moments: updatedMoments,
          settings: compilationSettings
        }),
      });

      if (!response.ok) throw new Error('Failed to start compilation');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compilation failed');
      setStep('editor');
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

        const nextStage = mapServerStageToProcessing(data.stage, data.status);
        setProcessingStage(prev => (nextStage ? nextStage : prev));

        if (Array.isArray(data.tasks) && data.tasks.length) {
          const logEntries = data.tasks
            .filter((task: any) => task.status !== 'pending')
            .map((task: any) => ({
              stage: taskStageMap[task.id] || 'detect',
              label: `${task.label}${task.detail ? ` · ${task.detail}` : ''}`,
              timestamp: new Date().toLocaleTimeString(),
            }));
          if (logEntries.length) {
            setActivityLog(logEntries.slice(-7));
          }
        }

        if (data.tiktokCaption) {
          setTiktokCaption(data.tiktokCaption);
        }

        if (data.status === 'analyzed') {
          // Analysis complete, switch to editor
          setBestMoments(data.moments || []);
          if (data.videoDurations) setVideoDurations(data.videoDurations);
          setProcessingStage('render'); // use 'render' visual stage for 'Ready to Edit'
          setStep('editor');
          setIsProcessing(false); // Stop the spinner loop visual? keep polling?
          // We need to keep polling if we were waiting, but here we pause.
          // Actually we stop polling when not isProcessing, so setting isProcessing=false stops it.
        } else if (data.status === 'ready') {
          setBestMoments(data.moments || []);
          setProcessingProgress(100);
          setProcessingStage('completed');
          setIsProcessing(false);
          setStep('preview');
        } else if (data.status === 'error') {
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
  }, [sessionId, isProcessing]);

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background text-foreground selection:bg-primary/30">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 pt-16">

        {/* HERO SECTION WITH PARALLAX & MASCOT */}
        <div className="relative min-h-[500px] flex items-center justify-center mb-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center w-full">

            {/* LEFT: Text Content with Parallax */}
            <motion.div
              style={{ y: yText, opacity: opacityHero }}
              className="text-left space-y-6 z-10"
            >
              <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 backdrop-blur-md mb-2">
                <span className="text-xs font-semibold text-primary tracking-wider uppercase">✨ AI Video Studio 2.0</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-tight">
                Viral Shorts <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-pink-600">
                  On Autopilot
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                Transform long videos into engaging TikToks, Reels & Shorts instantly.
                Featuring <span className="text-foreground font-medium">Auto-Framing</span>, <span className="text-foreground font-medium">Smart Captions</span>, and <span className="text-foreground font-medium">Viral Hooks</span>.
              </p>
              <div className="flex gap-4 pt-4">
                <button onClick={() => window.scrollTo({ top: 600, behavior: 'smooth' })} className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-primary/25">
                  Start Creating
                </button>
                <button className="px-8 py-4 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors">
                  View Demo
                </button>
              </div>
            </motion.div>

            {/* RIGHT: 3D Mascot with Parallax */}
            <motion.div
              style={{ y: yMascot, opacity: opacityHero }}
              className="relative h-[400px] lg:h-[500px] w-full flex items-center justify-center z-0"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-purple-500/10 to-transparent blur-[100px] rounded-full opacity-50 pointer-events-none" />
              <HeroMascot />
            </motion.div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-8 max-w-3xl rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive font-medium text-center"
          >
            {error}
          </motion.div>
        )}

        {/* WORKSPACE GRID */}
        <div className="grid lg:grid-cols-[1.5fr,1fr] gap-8 items-start max-w-6xl mx-auto">

          {/* LEFT COLUMN: Input & Preview */}
          <div className="space-y-6">
            <div className="glass-panel rounded-[32px] border border-border bg-card/40 p-1 shadow-2xl backdrop-blur-xl">
              <div className="bg-card w-full rounded-[28px] p-6 min-h-[600px] border border-border/50 relative overflow-hidden flex flex-col">

                <AnimatePresence mode="wait">
                  {step === 'input' && (
                    <motion.div
                      key="input"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                      transition={{ duration: 0.4 }}
                      className="space-y-8 flex-1"
                    >
                      <div className="text-center space-y-2 mb-8 pt-8">
                        <h2 className="text-xl font-semibold text-foreground">Import Videos</h2>
                        <p className="text-sm text-muted-foreground">Drop YouTube links to start magic</p>
                      </div>

                      <URLInput onAddVideos={handleAddVideos} />

                      {videos.length > 0 && (
                        <VideoPreview videos={videos} onRemoveVideo={handleRemoveVideo} />
                      )}
                    </motion.div>
                  )}

                  {step === 'processing' && (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                      className="py-12 flex-1 flex flex-col justify-center"
                    >
                      <ProcessingInterface
                        progress={processingProgress}
                        stage={processingStage}
                        activityLog={activityLog}
                        moments={bestMoments}
                      />
                    </motion.div>
                  )}

                  {step === 'editor' && (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.8, ease: "anticipate" }}
                      className="h-full flex-1"
                    >
                      <TimelineEditor
                        moments={bestMoments}
                        videoDurations={videoDurations}
                        onConfirm={handleEditorConfirm}
                        isProcessing={isProcessing}
                      />
                    </motion.div>
                  )}

                  {step === 'preview' && (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center space-y-8 py-12 flex-1"
                    >
                      <div className="text-center space-y-4">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", bounce: 0.5 }}
                          className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/30"
                        >
                          <span className="text-4xl">✨</span>
                        </motion.div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
                          Compilation Ready!
                        </h2>
                      </div>

                      {compiledVideoUrl ? (
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-black">
                          <video
                            src={compiledVideoUrl}
                            controls
                            className="max-h-[400px] w-auto aspect-[9/16]"
                          />
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-xl w-full">
                          Preparing download...
                        </div>
                      )}

                      <div className="flex gap-4 w-full max-w-sm">
                        <button
                          onClick={() => {
                            setStep('input');
                            setVideos([]);
                            setBestMoments([]);
                            setCompiledVideoUrl('');
                            setProcessingProgress(0);
                            setProcessingStage('idle');
                          }}
                          className="flex-1 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition-all text-sm"
                        >
                          New Project
                        </button>

                        {canDownload && (
                          <div className="flex-1">
                            <MagneticButton className="w-full">
                              <button
                                onClick={() => handleDownload('1080p')}
                                className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all text-sm"
                              >
                                <span>Download</span>
                                <span>⬇️</span>
                              </button>
                            </MagneticButton>
                          </div>
                        )}
                      </div>
                      <ConfettiSideCannons />
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Settings */}
          <div className="lg:sticky lg:top-8 space-y-6">
            <AnimatePresence>
              {(videos.length > 0 || compilationSettings) && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <CompilationSettings
                    onGenerate={handleGenerate}
                    videosCount={videos.length}
                    isProcessing={isProcessing}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pro Tip Card */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg">
                  💡
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Pro Tip</h4>
                  <p className="text-sm text-white/60 leading-relaxed">
                    For best results, use videos with clear speech. AI will auto-sync captions to the spoken audio.
                  </p>
                  <p className="text-xs text-white/40 mt-2 italic">
                    Try adding keyword rich captions for better engagement!
                  </p>
                </div>
              </div>
            </div>

            {/* Caption Preview (moved here for better layout) */}
            <AnimatePresence>
              {tiktokCaption && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel rounded-[24px] border border-border p-6 space-y-4 bg-card/80 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Generated Caption</h3>
                    <button
                      onClick={() => navigator.clipboard?.writeText(tiktokCaption)}
                      className="text-xs font-mono bg-primary/20 text-primary px-3 py-1 rounded-full hover:bg-primary/30 transition-colors"
                    >
                      COPY
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-muted border border-border">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed">
                      {tiktokCaption}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </main >
    </div >
  );
}
