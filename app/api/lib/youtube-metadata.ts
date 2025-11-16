export async function getYoutubeMetadataWithDuration(videoId: string) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Get metadata including duration
    const command = `yt-dlp --dump-json "https://www.youtube.com/watch?v=${videoId}"`;
    const { stdout } = await execAsync(command);
    const metadata = JSON.parse(stdout);

    const durationSeconds = metadata.duration || 0;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;

    return {
      id: videoId,
      title: metadata.title,
      author: metadata.uploader,
      thumbnail: metadata.thumbnail,
      duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
      durationSeconds,
    };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
