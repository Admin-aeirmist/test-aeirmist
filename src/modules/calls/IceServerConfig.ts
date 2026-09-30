import { logger } from '@/src/utils/logger';

export const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
      'stun:global.stun.twilio.com:3478'
    ]
  }
];

const CACHE_KEY = 'aeirmist_ice_servers_v2';
let memoryCachedIceServers: RTCIceServer[] | null = null;
let memoryCacheExpiry = 0;

export async function getEffectiveIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();

  // 1. Check in-memory cache
  if (memoryCachedIceServers && memoryCachedIceServers.length > 0 && now < memoryCacheExpiry) {
    return memoryCachedIceServers;
  }

  // 2. Check localStorage cache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.expiresAt && parsed.expiresAt > now && Array.isArray(parsed.iceServers) && parsed.iceServers.length > 0) {
          memoryCachedIceServers = parsed.iceServers;
          memoryCacheExpiry = parsed.expiresAt;
          logger.info(`[WebRTC] Using cached ICE servers with TURN until ${new Date(parsed.expiresAt).toLocaleTimeString()}`);
          return memoryCachedIceServers as RTCIceServer[];
        }
      }
    } catch (e) {
      // Local storage unreadable, continue to network fetch
    }
  }

  // 3. Resolve API URL (Android Capacitor WebView needs absolute origin)
  let endpoint = '/api/webrtc/ice-servers';
  if (typeof window !== 'undefined') {
    const isNative = (window as any).Capacitor?.isNativePlatform?.() || window.location.hostname === 'localhost' && window.location.port !== '5173' && window.location.port !== '5199';
    if (isNative) {
      endpoint = 'https://aeirmist.com/api/webrtc/ice-servers';
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        const hasTurn = data.iceServers.some((s: any) => {
          if (!s?.urls) return false;
          const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
          return urls.some((u: string) => typeof u === 'string' && (u.startsWith('turn:') || u.startsWith('turns:')));
        });

        logger.info(`[WebRTC] Fetched ${data.iceServers.length} ICE server configs (Relay TURN active: ${hasTurn})`);

        memoryCachedIceServers = data.iceServers;
        memoryCacheExpiry = now + (data.expiresAt ? Math.min(data.expiresAt - now, 12 * 3600 * 1000) : 12 * 3600 * 1000);

        if (typeof window !== 'undefined' && window.localStorage && hasTurn) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              iceServers: data.iceServers,
              expiresAt: memoryCacheExpiry
            }));
          } catch (e) {}
        }

        return memoryCachedIceServers as RTCIceServer[];
      }
    }
  } catch (err) {
    logger.warn("[WebRTC] Dynamic ICE server fetch deferred, evaluating cached or fallback servers", err);
  }

  // 4. Return fallback STUN servers
  return DEFAULT_STUN_SERVERS;
}
