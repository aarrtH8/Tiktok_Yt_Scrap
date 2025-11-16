import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '../lib/session-store';

function generateMP4WithMoments(moments: any[]): Buffer {
  // Create a valid-ish MP4 structure
  // For production, use FFmpeg, Mux, or AWS MediaConvert
  
  const header = Buffer.from([
    // ftyp box (file type)
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x00,
  ]);

  // mdat box with moment metadata
  const momentData = moments
    .map(m => `[${m.order}] ${m.title} @ ${m.timestamp}`)
    .join('\n');
  
  const mdatContent = Buffer.from(momentData, 'utf8');
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(mdatContent.length + 8, 0);
  mdatHeader.write('mdat', 4, 4, 'ascii');

  return Buffer.concat([header, mdatHeader, mdatContent]);
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, quality } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'No session ID provided' }, { status: 400 });
    }

    const sessionData = getSession(sessionId);

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const moments = sessionData.moments || [];
    console.log('[v0] Downloading compilation with', moments.length, 'moments');

    const videoBuffer = generateMP4WithMoments(moments);

    // Clean up session after download
    deleteSession(sessionId);

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="tiktok-compilation.mp4"',
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error) {
    console.error('[v0] Download error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate download',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
