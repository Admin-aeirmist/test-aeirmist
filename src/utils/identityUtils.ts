import { normalizeUsername } from './usernameUtils';

/**
 * AEIRMIST CANONICAL IDENTITY RESOLUTION UTILITY
 * 
 * Rules for resolving a Firebase account UID:
 * Priority:
 * 1. record.uid (if valid non-empty string and does NOT start with 'profile_')
 * 2. record.ownerUid (if valid non-empty string and does NOT start with 'profile_')
 * 3. If record.id or doc.id matches `profile_<UID>`, extract `<UID>`.
 * 4. If record.id is a string that is NOT prefixed with 'profile_' and is a valid UID, return record.id.
 * 5. Return null if canonical UID cannot be safely determined.
 */
export function getCanonicalUid(record: any): string | null {
  if (!record) return null;

  // Direct string input
  if (typeof record === 'string') {
    const trimmed = record.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('profile_')) {
      const extracted = trimmed.replace(/^profile_/, '').trim();
      return extracted || null;
    }
    return trimmed;
  }

  // 1. Check record.uid
  if (typeof record.uid === 'string' && record.uid.trim()) {
    const u = record.uid.trim();
    if (u.startsWith('profile_')) {
      const extracted = u.replace(/^profile_/, '').trim();
      if (extracted) return extracted;
    } else {
      return u;
    }
  }

  // 2. Check record.ownerUid
  if (typeof record.ownerUid === 'string' && record.ownerUid.trim()) {
    const ou = record.ownerUid.trim();
    if (ou.startsWith('profile_')) {
      const extracted = ou.replace(/^profile_/, '').trim();
      if (extracted) return extracted;
    } else {
      return ou;
    }
  }

  // 3. Check record.profileId
  if (typeof record.profileId === 'string' && record.profileId.trim()) {
    const p = record.profileId.trim();
    if (p.startsWith('profile_')) {
      const extracted = p.replace(/^profile_/, '').trim();
      if (extracted) return extracted;
    }
  }

  // 4. Check record.id or record.docId starting with 'profile_'
  const docId = typeof record.id === 'string' ? record.id.trim() : typeof record.docId === 'string' ? record.docId.trim() : '';
  if (docId.startsWith('profile_')) {
    const extracted = docId.replace(/^profile_/, '').trim();
    if (extracted) return extracted;
  }

  // 5. Fallback if record.id is a non-profile raw docId
  if (docId && !docId.startsWith('profile_')) {
    return docId;
  }

  // 6. Check record.rawRecord fallback
  if (record.rawRecord && typeof record.rawRecord === 'object') {
    const rawUid = getCanonicalUid(record.rawRecord);
    if (rawUid) return rawUid;
  }

  return null;
}

/**
 * Resolves the profile document ID for a given user record or document.
 */
export function getProfileId(record: any): string | null {
  if (!record) return null;

  if (typeof record === 'string') {
    const trimmed = record.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('profile_')) return trimmed;
    return `profile_${trimmed}`;
  }

  if (typeof record.profileId === 'string' && record.profileId.trim()) {
    return record.profileId.trim();
  }

  const docId = typeof record.id === 'string' ? record.id.trim() : '';
  if (docId.startsWith('profile_')) {
    return docId;
  }

  const canonicalUid = getCanonicalUid(record);
  if (canonicalUid) {
    return `profile_${canonicalUid}`;
  }

  return docId || null;
}

export interface NormalizedAdminUser {
  id: string;
  profileId: string;
  uid: string | null;
  username: string | null;
  usernameNormalized: string | null;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isVerified: boolean;
  isBanned: boolean;
  status: string;
  role: string;
  aeirmistLevel: number;
  needsIdentityReview?: boolean;
  rawRecord: any;
}

/**
 * Normalizes a raw Firestore profile or user document into a canonical Admin user structure.
 */
export function normalizeAdminUser(record: any): NormalizedAdminUser {
  if (!record) {
    return {
      id: '',
      profileId: '',
      uid: null,
      username: null,
      usernameNormalized: null,
      displayName: 'Unknown User',
      email: null,
      photoURL: null,
      isVerified: false,
      isBanned: false,
      status: 'UNKNOWN',
      role: 'USER',
      aeirmistLevel: 0,
      needsIdentityReview: true,
      rawRecord: null
    };
  }

  const uid = getCanonicalUid(record);
  const profileId = getProfileId(record) || (typeof record.id === 'string' ? record.id : '');
  const id = (typeof record.id === 'string' && record.id) ? record.id : (profileId || uid || '');
  
  const isAnonymized = record.isAnonymized || record.status === 'ANONYMIZED';
  const username = isAnonymized ? null : (record.username || null);
  const usernameNormalized = isAnonymized ? null : (record.usernameNormalized || (username ? normalizeUsername(username) : null));
  
  const displayName = isAnonymized ? 'Aeirmist User' : (record.displayName || username || 'Aeirmist User');

  return {
    ...record,
    id,
    profileId,
    uid,
    username,
    usernameNormalized,
    displayName,
    email: isAnonymized ? null : (record.email || record.personalEmail || null),
    photoURL: isAnonymized ? null : (record.photoURL || null),
    isVerified: Boolean(record.isVerified),
    isBanned: Boolean(record.isBanned || record.status === 'BANNED'),
    status: record.status || (record.isBanned ? 'BANNED' : 'ACTIVE'),
    role: record.role || (record.isAdmin ? 'Administrator' : 'USER'),
    aeirmistLevel: record.aeirmistLevel || 0,
    createdAt: record.createdAt || record.created_at || record.joinedAt || record.timestamp || record.dateCreated || record.metadata?.creationTime || null,
    bio: record.bio || '',
    needsIdentityReview: !uid || Boolean(record.needsIdentityReview),
    rawRecord: record
  };
}
