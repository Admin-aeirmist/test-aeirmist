import { aeirmistCache, FeedPostCacheItem, OfflineDraftItem } from './CacheService';

/**
 * LocalSqlService provides a structured local database API (backed by SQLite/IndexedDB
 * in Capacitor WebView) for offline feeds, user drafts, and storage telemetry.
 */
export class LocalSqlService {
  /**
   * Batch upsert feed posts to local database
   */
  static async saveFeedPosts(posts: any[]): Promise<void> {
    try {
      await aeirmistCache.saveFeedPosts(posts);
    } catch (err) {
      console.warn('[LocalSqlService] Failed to cache feed posts:', err);
    }
  }

  /**
   * Fetch cached feed posts sorted newest first
   */
  static async getFeedPosts(limitCount = 50): Promise<FeedPostCacheItem[]> {
    try {
      return await aeirmistCache.getFeedPosts(limitCount);
    } catch (err) {
      console.warn('[LocalSqlService] Failed to retrieve feed posts from local DB:', err);
      return [];
    }
  }

  /**
   * Clear cached posts
   */
  static async clearFeedPosts(): Promise<void> {
    try {
      await aeirmistCache.clearFeedPosts();
    } catch (err) {
      console.warn('[LocalSqlService] Failed to clear feed posts:', err);
    }
  }

  /**
   * Save user profile to local database vault (backed by SQLite/IndexedDB)
   */
  static async saveProfile(profile: any): Promise<void> {
    try {
      await aeirmistCache.saveProfile(profile);
    } catch (err) {
      console.warn('[LocalSqlService] Failed to cache profile:', err);
    }
  }

  /**
   * Retrieve cached user profile from local database vault
   */
  static async getProfile(id: string): Promise<any | null> {
    try {
      return await aeirmistCache.getProfile(id);
    } catch (err) {
      console.warn('[LocalSqlService] Failed to get profile from local DB:', err);
      return null;
    }
  }

  /**
   * Clear cached user profiles from local database vault
   */
  static async clearProfiles(): Promise<void> {
    try {
      await aeirmistCache.clearProfiles();
    } catch (err) {
      console.warn('[LocalSqlService] Failed to clear profiles in local DB:', err);
    }
  }

  /**
   * Save an offline draft (post, idea note, or story draft)
   */
  static async saveDraft(draft: {
    id?: string;
    type?: 'post' | 'story' | 'note';
    title?: string;
    content: string;
    mediaUrls?: string[];
  }): Promise<OfflineDraftItem | null> {
    try {
      return await aeirmistCache.saveDraft(draft);
    } catch (err) {
      console.error('[LocalSqlService] Failed to save offline draft:', err);
      return null;
    }
  }

  /**
   * Retrieve all saved offline drafts
   */
  static async getDrafts(): Promise<OfflineDraftItem[]> {
    try {
      return await aeirmistCache.getDrafts();
    } catch (err) {
      console.warn('[LocalSqlService] Failed to get offline drafts:', err);
      return [];
    }
  }

  /**
   * Delete a draft by ID
   */
  static async deleteDraft(id: string): Promise<void> {
    try {
      await aeirmistCache.deleteDraft(id);
    } catch (err) {
      console.warn('[LocalSqlService] Failed to delete draft:', err);
    }
  }

  /**
   * Get database metrics (counts of posts, drafts, messages)
   */
  static async getDatabaseStats() {
    try {
      return await aeirmistCache.getDatabaseStats();
    } catch (err) {
      return {
        postsCount: 0,
        draftsCount: 0,
        messagesCount: 0,
        mediaCount: 0,
        engine: 'SQLite / IndexedDB'
      };
    }
  }
}
