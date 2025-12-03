'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
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
      if (compiledVideoUrl) {
        URL.revokeObjectURL(compiledVideoUrl);
        setCompiledVideoUrl('');
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + Math.random() * 25, 90));
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

      const data = await response.json();
      setBestMoments(data.moments);
      setProcessingProgress(100);
      setIsProcessing(false);
      setStep('preview');
      setSessionId(data.sessionId); // Store sessionId from process response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing videos');
      console.error('[v0] Processing error:', err);
      setIsProcessing(false);
      setStep('input');
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
              <ProcessingInterface progress={processingProgress} moments={bestMoments} />
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <ProcessingInterface
                  progress={100}
                  moments={bestMoments}
                  onDownload={canDownload ? handleDownload : undefined}
                />
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Résultat final</h3>
                  {compiledVideoUrl ? (
                    <video
                      key={compiledVideoUrl}
                      controls
                      className="w-full rounded-lg border border-border bg-black max-h-[600px]"
                    >
                      <source src={compiledVideoUrl} type="video/mp4" />
                      Votre navigateur ne supporte pas la lecture vidéo.
                    </video>
                  ) : (
                    <div className="bg-muted rounded-lg aspect-[9/16] flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <div className="w-32 h-56 bg-background rounded-lg mx-auto flex items-center justify-center">
                          <span className="text-muted-foreground text-sm text-center px-4">
                            {canDownload
                              ? 'Clique sur “Download Video” pour générer la prévisualisation.'
                              : 'Prévisualisation disponible après la compilation.'}
                          </span>
                        </div>
                        {!canDownload && (
                          <p className="text-xs text-muted-foreground">
                            Assure-toi que la compilation est terminée puis relance le téléchargement.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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
