import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { mediaAssets, posts, profiles, stories } from '../db/schema';
import { sql } from 'drizzle-orm';
import { storage } from '../storage';

export interface CleanReport {
  scannedFiles: number;
  orphanCount: number;
  freedBytes: number;
  dryRun: boolean;
  orphanKeys: string[];
}

export async function cleanOrphanMedia(options: { dryRun?: boolean; olderThanHours?: number } = {}): Promise<CleanReport> {
  const dryRun = options.dryRun ?? true;
  const olderThanHours = options.olderThanHours ?? 24;
  const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

  const storageDir = path.resolve(process.cwd(), 'storage', 'uploads');
  if (!fs.existsSync(storageDir)) {
    return { scannedFiles: 0, orphanCount: 0, freedBytes: 0, dryRun, orphanKeys: [] };
  }

  // Fetch all known keys currently referenced across the database
  const [dbAssets, dbPosts, dbProfiles, dbStories] = await Promise.all([
    db.select({ key: mediaAssets.key }).from(mediaAssets),
    db.select({ mediaKeys: posts.mediaKeys }).from(posts),
    db.select({ avatar: profiles.avatarKey, banner: profiles.bannerKey }).from(profiles),
    db.select({ mediaUrl: stories.mediaUrl }).from(stories),
  ]);

  const activeKeys = new Set<string>();

  dbAssets.forEach((a) => {
    if (a.key) activeKeys.add(a.key);
  });

  dbPosts.forEach((p) => {
    if (Array.isArray(p.mediaKeys)) {
      p.mediaKeys.forEach((k) => k && activeKeys.add(k));
    }
  });

  dbProfiles.forEach((pr) => {
    if (pr.avatar) activeKeys.add(pr.avatar);
    if (pr.banner) activeKeys.add(pr.banner);
  });

  dbStories.forEach((st) => {
    if (st.mediaUrl) {
      // Extract key if it's a relative/direct key
      const cleanKey = st.mediaUrl.replace(/^.*[\\/]/, '');
      activeKeys.add(cleanKey);
      activeKeys.add(st.mediaUrl);
    }
  });

  // Read files from storage/uploads
  const files = fs.readdirSync(storageDir);
  let orphanCount = 0;
  let freedBytes = 0;
  const orphanKeys: string[] = [];

  for (const file of files) {
    const fullPath = path.join(storageDir, file);
    try {
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) continue;

      // Only check files older than cutoff
      if (stats.mtimeMs > cutoffTime) continue;

      // Check if file is tracked anywhere
      const isReferenced = activeKeys.has(file);

      if (!isReferenced) {
        orphanCount++;
        freedBytes += stats.size;
        orphanKeys.push(file);

        if (!dryRun) {
          try {
            await storage.delete(file);
          } catch (delErr) {
            console.error(`[MediaCleaner] Failed to delete orphan file: ${file}`, delErr);
          }
        }
      }
    } catch (statErr) {
      // Ignore transient file lock / stat errors
    }
  }

  return {
    scannedFiles: files.length,
    orphanCount,
    freedBytes,
    dryRun,
    orphanKeys: dryRun ? orphanKeys.slice(0, 50) : orphanKeys,
  };
}
