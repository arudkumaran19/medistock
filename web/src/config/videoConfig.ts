/**
 * MediStock Video Configuration
 *
 * AI Coordinator Demo Video Embed URL
 *
 * To add a video:
 * 1. Replace the empty string below with your approved video embed URL
 * 2. Only use HTTPS URLs from approved video providers (YouTube, Vimeo, etc.)
 * 3. Example: https://www.youtube.com/embed/VIDEO_ID or https://player.vimeo.com/video/VIDEO_ID
 *
 * When empty, the homepage will display a premium placeholder.
 * When configured, the homepage will embed the video.
 *
 * NOTE: Do not paste arbitrary HTML or execute embed scripts.
 * Use only approved embed URLs from trusted video platforms.
 */
export const MEDISTOCK_AI_DEMO_EMBED_URL = 'https://youtu.be/9JPkDgMWaoo';

/**
 * Validates if a URL is a safe embed URL
 * Only allows HTTPS URLs from approved video providers
 */
export function isValidEmbedUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Approved video providers
    const allowedHosts = [
      'www.youtube.com',
      'youtube.com',
      'youtu.be',
      'player.vimeo.com',
      'vimeo.com',
      'www.youtube-nocookie.com',
    ];

    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Normalizes user-provided video links to iframe-compatible embed URLs.
 */
export function formatEmbedUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '');
      return `https://www.youtube.com/embed/${id}`;
    }
    if ((parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') && parsed.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
    }
    return url;
  } catch {
    return url;
  }
}

