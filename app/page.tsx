'use client';

import { useState } from 'react';
import Header from '@/components/header';
import URLInput from '@/components/url-input';
import VideoPreview from '@/components/video-preview';
import CompilationSettings from '@/components/compilation-settings';
import ProcessingInterface from '@/components/processing-interface';

const resolveApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const backendPort = isLocalhost && port === '3000' ? '5000' : port;
    const portSuffix = backendPort ? `:${backendPort}` : '';
    return `${protocol}//${hostname}${portSuffix}`;
  }

  return '';
};

export default function Home() {
  // Define lightweight types for videos and moments to avoid `never[]` inference
  type Video = { id: string; [key: string]: any };
  type Moment = any;

  const [videos, setVideos] = useState<Video[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [bestMoments, setBestMoments] = useState<Moment[]>([]);
  const [step, setStep] = useState<'input' | 'processing' | 'preview'>('input'); // input, processing, preview
  const [error, setError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>(''); // New state to store sessionId

  const handleAddVideos = async (urls: string[]) => {
    try {
      setError('');
      const API_URL = resolveApiBase();
      if (!API_URL) {
        throw new Error('Aucune URL API configurée. Définissez NEXT_PUBLIC_API_URL ou servez le backend sur ce domaine.');
      }
      const response = await fetch(`${API_URL}/api/detect-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect videos');
      }

      const data = await response.json();
      setVideos(prev => [...prev, ...data.videos]);
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

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + Math.random() * 25, 90));
      }, 400);

      // Call video processing API
      const API_URL = resolveApiBase();
      if (!API_URL) {
        throw new Error('Aucune URL API configurée. Définissez NEXT_PUBLIC_API_URL ou servez le backend sur ce domaine.');
      }
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
      const API_URL = resolveApiBase();
      if (!API_URL) {
        throw new Error('Aucune URL API configurée. Définissez NEXT_PUBLIC_API_URL ou servez le backend sur ce domaine.');
      }
      const response = await fetch(`${API_URL}/api/download-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId, // Store sessionId from process response
          quality 
        }),
      });

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
              <ProcessingInterface progress={processingProgress} moments={bestMoments} onDownload={handleDownload} />
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <ProcessingInterface progress={100} moments={bestMoments} onDownload={handleDownload} />
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
