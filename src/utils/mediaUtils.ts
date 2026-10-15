/**
 * Universal Media URL Normalizer for Aeirmist
 * Handles local media paths, Cloudflare Pages, https://aeirmist.com, and local development seamlessly.
 */

export function normalizeMediaUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return clean;

  // Clean double slashes except after protocol
  clean = clean.replace(/^(https?:\/\/)\/+/i, '$1');

  // Strip localhost:4000 or 127.0.0.1:4000
  clean = clean.replace(/^https?:\/\/(localhost|127\.0\.0\.1):4000/i, '');

  // Strip accidental duplicate /media/ and double slashes
  clean = clean.replace(/\/+media\/+media\//gi, '/media/');
  if (clean.startsWith('/media/')) {
    clean = clean.replace(/^\/media\/+(media\/)+/gi, '/media/');
  }

  // If it's a relative media key without /media/ or leading /
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('/media/') && !clean.startsWith('/')) {
    clean = `/media/${clean}`;
  }

  // If on Cloudflare Pages remote domain or Capacitor, route /media/ to authoritative https://aeirmist.com
  if (clean.startsWith('/media/')) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.endsWith('.pages.dev') || window.location.protocol === 'capacitor:') {
        return `https://aeirmist.com${clean}`;
      }
    }
  }

  return clean;
}
