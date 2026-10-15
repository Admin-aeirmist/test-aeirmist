/**
 * SharedProfileCache — Universal Profile Cache Pool (PostgreSQL & API Powered)
 *
 * Replaces legacy Firestore onSnapshot listeners with instant zero-latency
 * in-memory caching and backend API reconciliation.
 *
 * Usage:
 *   const data = useSharedProfile(db, participantId);
 *   // data?.photoURL, data?.displayName, data?.isDeleted, etc.
 */
import { useState, useEffect } from 'react';
import { api } from '../services/api/client';

export interface SharedProfileData {
  photoURL?: string;
  displayName?: string;
  username?: string;
  isDeleted?: boolean;
  status?: string;
  lastSeen?: any;
  privacySettings?: { showActivity?: boolean; [k: string]: any };
  messagingSettings?: { onlineStatus?: boolean; [k: string]: any };
  [key: string]: any;
}

const memoryProfileCache = new Map<string, SharedProfileData>();
const activeSubscribers = new Map<string, Set<(data: SharedProfileData | null) => void>>();
const inFlightFetches = new Map<string, Promise<SharedProfileData | null>>();

function resolveAvatarKey(key?: string | null, fallback?: string | null): string | null {
  if (!key || typeof key !== 'string') return fallback || null;
  const k = key.trim();
  if (!k || k === 'null' || k === 'undefined') return fallback || null;
  // Already a full URL or data URI
  if (k.startsWith('http://') || k.startsWith('https://') || k.startsWith('data:') || k.startsWith('blob:')) return k;
  // Already has /media/ prefix — return as-is
  if (k.startsWith('/media/')) return k;
  // Bare key — add /media/ prefix
  return `/media/${k}`;
}

function normalizeProfileData(raw: any): SharedProfileData {
  if (!raw) return { isDeleted: false };
  const avatarUrl = resolveAvatarKey(raw.avatarKey) || raw.photoURL || raw.avatarUrl || null;

  return {
    ...raw,
    photoURL: avatarUrl || undefined,
    displayName: raw.displayName || raw.username || 'User',
    username: raw.username || '',
    isDeleted: Boolean(raw.isDeleted === true || raw.status === 'deleted' || raw.status === 'DELETED'),
    status: raw.status || 'active',
    lastSeen: raw.lastSeen || raw.updatedAt || null,
    privacySettings: raw.privacySettings || { showActivity: true },
    messagingSettings: raw.messagingSettings || { onlineStatus: true },
  };
}

async function fetchProfile(cleanId: string): Promise<SharedProfileData | null> {
  if (inFlightFetches.has(cleanId)) {
    return inFlightFetches.get(cleanId)!;
  }

  const promise = (async () => {
    try {
      const res: any = await api.users.getProfile(cleanId);
      if (res && res.profile) {
        const normalized = normalizeProfileData(res.profile);
        memoryProfileCache.set(cleanId, normalized);
        
        // Notify subscribers
        const subs = activeSubscribers.get(cleanId);
        if (subs) {
          subs.forEach(cb => cb(normalized));
        }
        return normalized;
      }
    } catch (e) {
      // Profile not found or network error
    } finally {
      inFlightFetches.delete(cleanId);
    }
    return null;
  })();

  inFlightFetches.set(cleanId, promise);
  return promise;
}

export function useSharedProfile(
  _db: any,
  profileId: string | null | undefined
): SharedProfileData | null {
  const cleanId = profileId ? String(profileId).trim().replace(/^profile_/, '') : '';
  const [data, setData] = useState<SharedProfileData | null>(() => {
    if (!cleanId) return null;
    return memoryProfileCache.get(cleanId) || null;
  });

  useEffect(() => {
    if (!cleanId) {
      setData(null);
      return;
    }

    const cached = memoryProfileCache.get(cleanId);
    if (cached) {
      setData(cached);
    }

    if (!activeSubscribers.has(cleanId)) {
      activeSubscribers.set(cleanId, new Set());
    }
    activeSubscribers.get(cleanId)!.add(setData);

    // Fetch from backend API if not in cache or cached without username
    if (!cached || !cached.username) {
      fetchProfile(cleanId);
    }

    return () => {
      const subs = activeSubscribers.get(cleanId);
      if (subs) {
        subs.delete(setData);
        if (subs.size === 0) {
          activeSubscribers.delete(cleanId);
        }
      }
    };
  }, [cleanId]);

  return data;
}

/** Imperatively clear the cache (e.g. on logout). */
export function clearProfileCache() {
  memoryProfileCache.clear();
  activeSubscribers.clear();
  inFlightFetches.clear();
}
