import { useState, useEffect } from 'react';
import { api } from '../services/api/client';

export interface SharedProfileData {
  photoURL?: string;
  avatarKey?: string;
  displayName?: string;
  username?: string;
  isDeleted?: boolean;
  status?: string;
  lastSeen?: any;
  privacySettings?: { showActivity?: boolean; [k: string]: any };
  messagingSettings?: { onlineStatus?: boolean; [k: string]: any };
  [key: string]: any;
}

const profileCache = new Map<string, SharedProfileData>();
const subscribersMap = new Map<string, Set<(data: SharedProfileData | null) => void>>();

export function useSharedProfile(
  _db: any,
  profileId: string | null | undefined
): SharedProfileData | null {
  const [data, setData] = useState<SharedProfileData | null>(() => {
    if (!profileId) return null;
    const clean = profileId.replace(/^profile_/, '').trim();
    return profileCache.get(clean) || null;
  });

  useEffect(() => {
    if (!profileId || typeof profileId !== 'string' || !profileId.trim()) {
      setData(null);
      return;
    }
    const clean = profileId.replace(/^profile_/, '').trim();
    if (!clean) return;

    if (!subscribersMap.has(clean)) {
      subscribersMap.set(clean, new Set());
    }
    const subs = subscribersMap.get(clean)!;
    subs.add(setData);

    if (profileCache.has(clean)) {
      setData(profileCache.get(clean)!);
    } else {
      api.users.getProfile(clean)
        .then(res => {
          if (res?.profile) {
            const p = res.profile;
            const mapped: SharedProfileData = {
              ...p,
              photoURL: p.avatarKey || p.photoURL,
              displayName: p.displayName || p.username,
              isDeleted: p.status === 'DELETED',
            };
            profileCache.set(clean, mapped);
            subs.forEach(cb => cb(mapped));
          }
        })
        .catch(() => {
          // graceful fallback
        });
    }

    return () => {
      subs.delete(setData);
    };
  }, [profileId]);

  return data;
}

export function clearProfileCache() {
  profileCache.clear();
  subscribersMap.clear();
}
