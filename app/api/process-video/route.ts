import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '../lib/session-store';
import { analyzeYouTubeVideo } from '../lib/youtube-analyzer';

function detectBestMoments(videoDuration: number, outputDuration: number): any[] {
  const avgClipDuration = 4.5;
  const numClips = Math.ceil(outputDuration / avgClipDuration);
  const moments = [];
  
  for (let i = 0; i < numClips; i++) {
    const position = (i + 1) / (numClips + 1);
    const baseTimestamp = videoDuration * position;
    const variance = (Math.random() - 0.5) * (videoDuration * 0.1);
    const timestamp = Math.max(0, Math.min(baseTimestamp + variance, Math.max(videoDuration - 5, 0)));
    
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    
    moments.push({
      timestamp: `${minutes}:${String(seconds).padStart(2, '0')}`,
      duration: '4-5s',
      start: Math.floor(timestamp),
      end: Math.min(Math.floor(timestamp) + 5, videoDuration),
      title: generateMomentTitle(i),
      score: 0.80 + Math.random() * 0.2,
      engagementLevel: Math.random() > 0.5 ? 'High' : 'Medium',
    });
  }
  
  return moments;
}

function generateMomentTitle(index: number): string {
  const titles = [
    'Peak engagement',
    'Viral transition',
    'Key highlight',
    'Audience hook',
    'Entertainment spike',
    'Dynamic moment',
    'Reaction peak',
  ];
  return titles[index % titles.length];
}

export async function POST(request: NextRequest) {
  try {
    const { videos, settings } = await request.json();

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    const outputDuration = parseInt(settings?.duration) || 30;
    const allMoments: any[] = [];

    for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
      const video = videos[videoIndex];
      const videoDuration = video.duration || 600;
      
      const moments = detectBestMoments(videoDuration, outputDuration);
      
      const momentsWithMetadata = moments.map((moment, idx) => ({
        ...moment,
        videoIndex,
        videoTitle: video.title,
        videoId: video.id,
        order: allMoments.length + idx + 1,
      }));
      
      allMoments.push(...momentsWithMetadata);
    }

    const clipDuration = 4.5;
    const targetClipCount = Math.ceil(outputDuration / clipDuration);
    const topMoments = allMoments
      .sort((a, b) => b.score - a.score)
      .slice(0, targetClipCount)
      .sort((a, b) => a.order - b.order);

    const sessionData = {
      moments: topMoments.map(({ start, end, videoIndex, ...rest }) => ({
        ...rest,
        start,
        end,
        videoIndex,
      })),
      videosCount: videos.length,
      quality: settings?.quality || '720p',
      duration: outputDuration,
      createdAt: new Date().toISOString(),
    };

    const sessionId = createSession(sessionData);

    console.log('[v0] Created session:', sessionId, 'with', topMoments.length, 'moments');

    return NextResponse.json({
      success: true,
      moments: topMoments.map(({ start, end, videoIndex, ...rest }) => rest),
      sessionId,
      videoCount: videos.length,
      clipCount: topMoments.length,
      totalDuration: outputDuration,
    });
  } catch (error) {
    console.error('[v0] Processing error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process videos',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
