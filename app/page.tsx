'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [bestMoments, setBestMoments] = useState([]);
  const [step, setStep] = useState('input'); // input, processing, preview
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(''); // New state to store sessionId
  const [progressTasks, setProgressTasks] = useState<any[]>([]);
  const [statusLabel, setStatusLabel] = useState('');
  const [etaTotalSeconds, setEtaTotalSeconds] = useState<number | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, []);

  const handleAddVideos = async (urls: string[]) => {
    try {
      setError('');
      const response = await fetch(API_ENDPOINTS.detectVideo, {
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
      if (err instanceof TypeError) {
        // Network-level error: most likely backend unreachable or blocked (CORS/HTTPS mismatch)
        setError(
          `Impossible de contacter l'API (${API_BASE_URL}). Vérifie que le backend est démarré et que NEXT_PUBLIC_API_URL pointe vers l'URL accessible.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error loading videos');
      }
      console.error('[v0] Video detection error:', err);
    }
  };

  const handleRemoveVideo = (id: string) => {
    setVideos(videos.filter(v => v.id !== id));
  };

  const handleGenerate = async (settings: any) => {
    const stopPolling = () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };

    const pollProgress = async (sid: string) => {
      try {
        const response = await fetch(API_ENDPOINTS.progress(sid));
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        const data = await response.json();
        setProcessingProgress(Math.round(data.progress ?? 0));
        setStatusLabel(data.stage || '');
        setProgressTasks(data.tasks || []);
        setEtaTotalSeconds(data.etaTotalSeconds ?? null);

        if (data.status === 'ready') {
          stopPolling();
          setProcessingProgress(100);
          setBestMoments(data.moments || []);
          setIsProcessing(false);
          setStep('preview');
          setSessionId(sid);
        } else if (data.status === 'error') {
          stopPolling();
          setError(data.error || 'Erreur pendant le traitement');
          setIsProcessing(false);
          setStep('input');
        }
      } catch (err) {
        console.error('Progress polling error:', err);
      }
    };

    try {
      setError('');
      setIsProcessing(true);
      setStep('processing');
      setProcessingProgress(0);
      setProgressTasks([]);
      setStatusLabel('Initialisation');

      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }

      // Call video processing API (async)
      const response = await fetch(API_ENDPOINTS.processVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to process videos');
      }

      const data = await response.json();
      const sid = data.sessionId;
      setSessionId(sid);
      pollProgress(sid);
      pollerRef.current = setInterval(() => pollProgress(sid), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing videos');
      console.error('[v0] Processing error:', err);
      if (pollerRef.current) clearInterval(pollerRef.current);
      setIsProcessing(false);
      setStep('input');
    }
  };

  const handleDownload = async (quality: string) => {
    try {
      setError('');
      // Marquer compilation comme en cours côté UI
      setStatusLabel('Compilation en cours');
      setProgressTasks(prev =>
        prev.map(t =>
          t.id === 'compile'
            ? { ...t, status: 'in_progress', progress: t.progress ?? 0 }
            : t
        )
      );

      const pollProgress = async (sid: string) => {
        try {
          const res = await fetch(API_ENDPOINTS.progress(sid));
          if (!res.ok) return;
          const data = await res.json();
          setProgressTasks(data.tasks || []);
          setStatusLabel(data.stage || 'Compilation en cours');
        } catch (err) {
          console.error('Progress polling error (download):', err);
        }
      };

      if (pollerRef.current) clearInterval(pollerRef.current);
      if (sessionId) {
        pollerRef.current = setInterval(() => pollProgress(sessionId), 5000);
      }

      const response = await fetch(API_ENDPOINTS.downloadVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionId, // Store sessionId from process response
          quality 
        }),
      });
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      if (sessionId) {
        await pollProgress(sessionId);
      }

      if (!response.ok) {
        throw new Error('Failed to download video');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tiktok-compilation.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error downloading video');
      console.error('[v0] Download error:', err);
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {step === 'input' && (
              <>
                <URLInput onAddVideos={handleAddVideos} />
                {videos.length > 0 && (
                  <VideoPreview videos={videos} onRemoveVideo={handleRemoveVideo} />
                )}
              </>
            )}
            
            {step === 'processing' && (
              <ProcessingInterface 
                progress={processingProgress} 
                moments={bestMoments} 
                statusLabel={statusLabel}
                tasks={progressTasks}
                isProcessing={isProcessing}
                totalEtaSeconds={etaTotalSeconds ?? undefined}
              />
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <ProcessingInterface progress={100} moments={bestMoments} onDownload={handleDownload} statusLabel="Terminé" tasks={progressTasks} totalEtaSeconds={0} />
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Vertical Preview (9:16)</h3>
                  <div className="bg-muted rounded-lg aspect-[9/16] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-32 h-56 bg-background rounded-lg mx-auto mb-4 flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">TikTok Preview</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <CompilationSettings 
              onGenerate={handleGenerate}
              videosCount={videos.length}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
