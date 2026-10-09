import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Extracts raw storage key from either a full media URL or relative path
 */
export function extractMediaKey(urlOrKey?: string | null): string | null {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();

  // Strip leading domain if present (e.g. http://localhost:4000/media/... or https://aeirmist.com/media/...)
  let relative = trimmed;
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      relative = parsed.pathname;
    }
  } catch {}

  if (relative.startsWith('/api/v1/media/')) {
    return relative.replace(/^\/api\/v1\/media\//, '');
  }
  if (relative.includes('/api/v1/media/')) {
    return relative.split('/api/v1/media/')[1];
  }
  if (relative.startsWith('/media/')) {
    return relative.replace(/^\/media\//, '');
  }
  if (relative.includes('/media/')) {
    return relative.split('/media/')[1];
  }

  // Check if it matches a standard stored asset pattern like "folder/year/month/uuid.ext"
  if (/^[a-zA-Z0-9_-]+\/\d{4}\/\d{2}\/[a-zA-Z0-9_.-]+$/.test(relative)) {
    return relative;
  }
  return null;
}

/**
 * Asserts that the authenticated user owns the referenced media asset.
 * Returns false if:
 * 1. The media key references an internal asset that does not exist in the database.
 * 2. The media asset is owned by another user.
 */
export async function assertMediaOwnership(urlOrKey: string | null | undefined, userId: string): Promise<boolean> {
  if (!urlOrKey) return true;
  const key = extractMediaKey(urlOrKey);
  if (!key) {
    // If it's a external link or data URI, allow unless it looks like an unauthorized local key
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://') || urlOrKey.startsWith('data:')) {
      return true;
    }
    // Ambiguous raw string provided as mediaKey - verify as key
    const [rawAsset] = await db
      .select({ ownerId: mediaAssets.ownerId })
      .from(mediaAssets)
      .where(eq(mediaAssets.key, urlOrKey.trim()))
      .limit(1);
    if (!rawAsset) return false;
    return !rawAsset.ownerId || rawAsset.ownerId === userId;
  }

  const [asset] = await db
    .select({ ownerId: mediaAssets.ownerId })
    .from(mediaAssets)
    .where(eq(mediaAssets.key, key))
    .limit(1);

  if (!asset) {
    return false; // Reject missing / unrecorded media asset keys
  }

  if (asset.ownerId && asset.ownerId !== userId) {
    return false; // Reject assets belonging to another user
  }

  return true;
}
