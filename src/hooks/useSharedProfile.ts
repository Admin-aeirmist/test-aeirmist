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
import { resolveAvatarSrc } from '../lib/avatar';
import { getSocket } from '../services/api/socket';

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

const ERA_AI_USER_ID = '00000000-0000-4000-a000-000000000001';
const PROFILE_TTL_MS = 60_000;

const memoryProfileCache = new Map<string, SharedProfileData>();
const profileFetchedAt = new Map<string, number>();
const activeSubscribers = new Map<string, Set<(data: SharedProfileData | null) => void>>();
const inFlightFetches = new Map<string, Promise<SharedProfileData | null>>();
let isGlobalListenerAttached = false;

function normalizeProfileData(raw: any): SharedProfileData {
  if (!raw) return { isDeleted: false };
  const isEra =
    raw.userId === ERA_AI_USER_ID ||
    raw.id === ERA_AI_USER_ID ||
    raw.profileId === ERA_AI_USER_ID ||
    raw.username === 'era';

  const avatarUrl =
    resolveAvatarSrc(raw.avatarKey) ||
    resolveAvatarSrc(raw.photoURL) ||
    resolveAvatarSrc(raw.avatarUrl) ||
    (isEra ? 'ai:era_official' : null);

  return {
    ...raw,
    photoURL: avatarUrl || undefined,
    avatarKey: raw.avatarKey || (isEra ? 'ai:era_official' : undefined),
    displayName: raw.displayName || (isEra ? 'Era AI' : raw.username) || 'User',
    username: raw.username || (isEra ? 'era' : ''),
    isVerified: raw.isVerified ?? (isEra ? true : undefined),
    isDeleted: Boolean(raw.isDeleted === true || raw.status === 'deleted' || raw.status === 'DELETED'),
    status: raw.status || 'active',
    lastSeen: raw.lastSeen || raw.updatedAt || null,
    privacySettings: raw.privacySettings || { showActivity: true },
    messagingSettings: raw.messagingSettings || { onlineStatus: true },
  };
}

function broadcastToSubscribers(keys: Array<string | undefined | null>, data: SharedProfileData) {
  const seen = new Set<string>();
  const now = Date.now();
  for (const rawKey of keys) {
    if (!rawKey) continue;
    const clean = String(rawKey).trim().replace(/^profile_/, '');
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    memoryProfileCache.set(clean, data);
    profileFetchedAt.set(clean, now);
    const subs = activeSubscribers.get(clean);
    if (subs) {
      subs.forEach(cb => cb(data));
    }
  }
}

export function seedSharedProfile(
  identifierOrIds: string | Array<string | undefined | null>,
  rawProfile: Partial<SharedProfileData>
) {
  if (!rawProfile) return;
  const ids = Array.isArray(identifierOrIds) ? identifierOrIds : [identifierOrIds];
  const baseKeys = [
    ...ids,
    rawProfile.userId,
    rawProfile.id,
    rawProfile.profileId,
    rawProfile.firebaseUid,
    rawProfile.username,
  ];
  const firstValid = baseKeys.find(Boolean);
  const existing = firstValid ? memoryProfileCache.get(String(firstValid).trim().replace(/^profile_/, '')) : null;
  const normalized = normalizeProfileData({ ...(existing || {}), ...rawProfile });
  broadcastToSubscribers(baseKeys, normalized);
}

export function invalidateSharedProfile(identifierOrIds: string | Array<string | undefined | null>) {
  const ids = Array.isArray(identifierOrIds) ? identifierOrIds : [identifierOrIds];
  for (const id of ids) {
    if (!id) continue;
    const clean = String(id).trim().replace(/^profile_/, '');
    if (!clean) continue;
    profileFetchedAt.delete(clean);
    fetchProfile(clean);
  }
}

function ensureGlobalProfileListeners() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;
  isGlobalListenerAttached = true;

  const handleUpdate = (payload: any) => {
    if (!payload) return;
    const keys = [
      payload.userId,
      payload.profileId,
      payload.id,
      payload.firebaseUid,
      payload.username,
    ].filter(Boolean);
    if (keys.length === 0) return;

    const patch: any = { ...payload };
    if (payload.avatarKey !== undefined) {
      patch.photoURL = resolveAvatarSrc(payload.avatarKey) || payload.photoURL;
    } else if (payload.photoURL !== undefined) {
      patch.photoURL = resolveAvatarSrc(payload.photoURL) || payload.photoURL;
    }
    seedSharedProfile(keys, patch);
  };

  window.addEventListener('aeirmist:profile_updated', (ev: any) => {
    handleUpdate(ev?.detail);
  });

  try {
    const socket = getSocket();
    socket.on('profile_updated', handleUpdate);
  } catch {}
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
        broadcastToSubscribers(
          [cleanId, normalized.userId, normalized.id, normalized.profileId, normalized.username],
          normalized
        );
        return normalized;
      }
    } catch {
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
    const cached = memoryProfileCache.get(cleanId);
    if (cached) return cached;
    if (cleanId === ERA_AI_USER_ID || cleanId === 'era') {
      return normalizeProfileData({
        userId: ERA_AI_USER_ID,
        id: ERA_AI_USER_ID,
        username: 'era',
        displayName: 'Era AI',
        avatarKey: 'ai:era_official',
        isVerified: true,
      });
    }
    return null;
  });

  useEffect(() => {
    ensureGlobalProfileListeners();

    if (!cleanId) {
      setData(null);
      return;
    }

    const cached = memoryProfileCache.get(cleanId);
    if (cached) {
      setData(cached);
    } else if (cleanId === ERA_AI_USER_ID || cleanId === 'era') {
      setData(
        normalizeProfileData({
          userId: ERA_AI_USER_ID,
          id: ERA_AI_USER_ID,
          username: 'era',
          displayName: 'Era AI',
          avatarKey: 'ai:era_official',
          isVerified: true,
        })
      );
    }

    if (!activeSubscribers.has(cleanId)) {
      activeSubscribers.set(cleanId, new Set());
    }
    activeSubscribers.get(cleanId)!.add(setData);

    const lastFetch = profileFetchedAt.get(cleanId) || 0;
    const isStale = Date.now() - lastFetch > PROFILE_TTL_MS;
    if (!cached || !cached.username || isStale) {
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
  profileFetchedAt.clear();
  activeSubscribers.clear();
  inFlightFetches.clear();
}
