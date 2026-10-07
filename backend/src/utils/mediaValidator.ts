import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Extracts raw storage key from either a full media URL or relative path
 */
export function extractMediaKey(urlOrKey?: string | null): string | null {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();
  if (trimmed.startsWith('/api/v1/media/')) {
    return trimmed.replace(/^\/api\/v1\/media\//, '');
  }
  if (trimmed.includes('/api/v1/media/')) {
    return trimmed.split('/api/v1/media/')[1];
  }
  // Check if it matches a standard stored asset pattern like "folder/year/month/uuid.ext"
  if (/^[a-zA-Z0-9_-]+\/\d{4}\/\d{2}\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Asserts that the authenticated user owns the referenced media asset.
 * Returns false if the media asset is explicitly owned by a different user.
 */
export async function assertMediaOwnership(urlOrKey: string | null | undefined, userId: string): Promise<boolean> {
  const key = extractMediaKey(urlOrKey);
  if (!key) return true; // External URL, data URI, or non-asset link

  const [asset] = await db
    .select({ ownerId: mediaAssets.ownerId })
    .from(mediaAssets)
    .where(eq(mediaAssets.key, key))
    .limit(1);

  if (asset && asset.ownerId && asset.ownerId !== userId) {
    return false;
  }
  return true;
}
