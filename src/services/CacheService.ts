import { openDB, IDBPDatabase } from 'idb';

export interface FeedPostCacheItem {
  id: string;
  authorId: string;
  authorName?: string;
  authorUsername?: string;
  authorPhoto?: string;
  authorTier?: string;
  content: string;
  mediaUrls?: string[];
  likesCount?: number;
  commentsCount?: number;
  createdAt: number;
  cachedAt: number;
  raw?: any;
}

export interface OfflineDraftItem {
  id: string;
  type: 'post' | 'story' | 'note';
  title?: string;
  content: string;
  mediaUrls?: string[];
  createdAt: number;
  updatedAt: number;
}

interface AeirmistDBSchema {
  messages: {
    key: string;
    value: {
      id: string;
      conversationId: string;
      senderId: string;
      text: string;
      type: string;
      mediaUrl?: string;
      timestamp: number;
      metadata?: any;
    };
    indexes: { 'by-conversation': string };
  };
  media: {
    key: string;
    value: {
      url: string;
      blob: Blob;
      timestamp: number;
      type: string;
    };
  };
  conversations: {
    key: string;
    value: any;
  };
  pending_uploads: {
    key: string;
    value: {
      id: string;
      path: string;
      blob: Blob;
      timestamp: number;
    };
  };
  feed_posts: {
    key: string;
    value: FeedPostCacheItem;
    indexes: { 'by-createdAt': number };
  };
  offline_drafts: {
    key: string;
    value: OfflineDraftItem;
    indexes: { 'by-type': string };
  };
  profiles: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'aeirmist_vault';
const DB_VERSION = 4;

class CacheService {
  private db: Promise<IDBPDatabase<AeirmistDBSchema>>;

  constructor() {
    this.db = openDB<AeirmistDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-conversation', 'conversationId');
          db.createObjectStore('media', { keyPath: 'url' });
          db.createObjectStore('conversations', { keyPath: 'id' });
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('pending_uploads')) {
            db.createObjectStore('pending_uploads', { keyPath: 'id' });
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('feed_posts')) {
            const feedStore = db.createObjectStore('feed_posts', { keyPath: 'id' });
            feedStore.createIndex('by-createdAt', 'createdAt');
          }
          if (!db.objectStoreNames.contains('offline_drafts')) {
            const draftsStore = db.createObjectStore('offline_drafts', { keyPath: 'id' });
            draftsStore.createIndex('by-type', 'type');
          }
        }

        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('profiles')) {
            db.createObjectStore('profiles', { keyPath: 'id' });
          }
        }
      },
    });
    if (typeof window !== 'undefined') {
      this.clearCorruptMedia().catch(() => {});
    }
  }

  // --- Messages ---
  async saveMessage(message: any) {
    if (!message || !message.id) return;
    const db = await this.db;
    return db.put('messages', {
      ...message,
      conversationId: message.conversationId || message.chatId,
      timestamp: message.timestamp?.toMillis ? message.timestamp.toMillis() : (message.timestamp || Date.now())
    });
  }

  async saveMessages(conversationId: string, messages: any[]) {
    if (!conversationId || !messages || messages.length === 0) return;
    try {
      const db = await this.db;
      const tx = db.transaction('messages', 'readwrite');
      for (const m of messages) {
        if (!m || !m.id) continue;
        const ts = typeof m.timestampMs === 'number' && m.timestampMs > 0 
          ? m.timestampMs 
          : (m.timestamp?.toMillis ? m.timestamp.toMillis() : (m.timestamp || Date.now()));
        tx.store.put({
          ...m,
          conversationId,
          timestamp: ts
        });
      }
      await tx.done;
    } catch (e) {
      // ignore cache failure
    }
  }

  async getMessages(conversationId: string) {
    const db = await this.db;
    return db.getAllFromIndex('messages', 'by-conversation', conversationId);
  }

  // --- Media ---
  async isValidMediaBlob(blob: any): Promise<boolean> {
    if (!(blob instanceof Blob) || blob.size < 32) return false;
    const t = (blob.type || '').toLowerCase();
    if (t.startsWith('text/') || t.includes('html') || t.includes('json') || t.includes('xml')) {
      return false;
    }
    try {
      const buf = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
      if (buf.length < 12) return false;
      const head = String.fromCharCode(...buf.slice(0, 16)).trim().toLowerCase();
      if (
        head.startsWith('not found') ||
        head.startsWith('<!doc') ||
        head.startsWith('<html') ||
        head.startsWith('<error') ||
        head.startsWith('<?xml') ||
        head.startsWith('{')
      ) {
        return false;
      }
      if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/')) {
        return true;
      }
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
      const isRiff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
      const isMp4 = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
      const isWebm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
      const isSvg = head.includes('<svg');
      return isJpeg || isPng || isGif || isRiff || isMp4 || isWebm || isSvg;
    } catch {
      return false;
    }
  }

  async saveMedia(url: string, blob: Blob, type: string) {
    if (!(await this.isValidMediaBlob(blob))) return;
    const db = await this.db;
    return db.put('media', {
      url,
      blob,
      type: blob.type || type,
      timestamp: Date.now()
    });
  }

  async getMedia(url: string) {
    const db = await this.db;
    const item = await db.get('media', url);
    if (!item) return null;
    if (!(await this.isValidMediaBlob(item.blob))) {
      await db.delete('media', url).catch(() => {});
      return null;
    }
    return item.blob;
  }

  async deleteMedia(url: string) {
    try {
      const db = await this.db;
      await db.delete('media', url);
    } catch {}
  }

  async clearCorruptMedia() {
    try {
      const db = await this.db;
      const entries = await db.getAll('media');
      const badUrls: string[] = [];
      for (const entry of entries) {
        if (!entry?.url) continue;
        const ok = await this.isValidMediaBlob(entry.blob);
        if (!ok) {
          badUrls.push(entry.url);
        }
      }
      if (badUrls.length > 0) {
        const tx = db.transaction('media', 'readwrite');
        for (const u of badUrls) {
          tx.store.delete(u);
        }
        await tx.done;
      }
    } catch {}
  }

  async clearOldCache() {
    const db = await this.db;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const tx = db.transaction('media', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.value.timestamp < sevenDaysAgo) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
  }

  // --- Conversations ---
  async saveConversation(conv: any) {
    const db = await this.db;
    return db.put('conversations', conv);
  }

  async getConversations() {
    const db = await this.db;
    return db.getAll('conversations');
  }

  // --- Pending Uploads ---
  async savePendingUpload(id: string, path: string, blob: Blob) {
    const db = await this.db;
    return db.put('pending_uploads', {
      id,
      path,
      blob,
      timestamp: Date.now()
    });
  }

  async getPendingUploads() {
    const db = await this.db;
    return db.getAll('pending_uploads');
  }

  async removePendingUpload(id: string) {
    const db = await this.db;
    return db.delete('pending_uploads', id);
  }

  // --- Feed Posts (Local SQL / Storage Layer) ---
  async saveFeedPosts(posts: any[]) {
    if (!posts || !posts.length) return;
    const db = await this.db;
    const tx = db.transaction('feed_posts', 'readwrite');
    for (const p of posts) {
      if (!p || !p.id) continue;
      let createdTime = Date.now();
      try {
        if (p.createdAt?.toMillis) createdTime = p.createdAt.toMillis();
        else if (p.createdAt?.toDate) createdTime = p.createdAt.toDate().getTime();
        else if (p.createdAt instanceof Date) createdTime = p.createdAt.getTime();
        else if (p.createdAt?.seconds) createdTime = p.createdAt.seconds * 1000;
        else if (typeof p.createdAt === 'number') createdTime = p.createdAt;
      } catch {
        createdTime = Date.now();
      }

      await tx.store.put({
        id: String(p.id),
        authorId: p.authorId || p.userId || '',
        authorName: p.authorName || p.userName || p.displayName || '',
        authorUsername: p.authorUsername || p.username || '',
        authorPhoto: p.authorPhoto || p.userAvatar || p.photoURL || '',
        authorTier: p.authorTier || p.tier || '',
        content: p.content || p.caption || p.text || '',
        mediaUrls: Array.isArray(p.mediaUrls) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : (p.imageUrl ? [p.imageUrl] : [])),
        likesCount: Number(p.likesCount ?? (p.likes ? Object.keys(p.likes).length : 0)),
        commentsCount: Number(p.commentsCount ?? 0),
        createdAt: createdTime,
        cachedAt: Date.now(),
        raw: p
      });
    }
    await tx.done;
  }

  async getFeedPosts(limitCount = 50): Promise<FeedPostCacheItem[]> {
    const db = await this.db;
    const all = await db.getAll('feed_posts');
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limitCount);
  }

  async clearFeedPosts() {
    const db = await this.db;
    return db.clear('feed_posts');
  }

  // --- Offline Drafts ---
  async saveDraft(draft: { id?: string; type?: 'post' | 'story' | 'note'; title?: string; content: string; mediaUrls?: string[] }) {
    const db = await this.db;
    const now = Date.now();
    const id = draft.id || `draft_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const item: OfflineDraftItem = {
      id,
      type: draft.type || 'post',
      title: draft.title || '',
      content: draft.content,
      mediaUrls: draft.mediaUrls || [],
      createdAt: now,
      updatedAt: now
    };
    await db.put('offline_drafts', item);
    return item;
  }

  async getDrafts(): Promise<OfflineDraftItem[]> {
    const db = await this.db;
    const all = await db.getAll('offline_drafts');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteDraft(id: string) {
    const db = await this.db;
    return db.delete('offline_drafts', id);
  }

  // --- Local Vault Profiles (Persistent Profile Storage) ---
  async saveProfile(profile: any): Promise<void> {
    if (!profile || !profile.id) return;
    try {
      const db = await this.db;
      await db.put('profiles', {
        ...profile,
        cachedAt: Date.now()
      });
    } catch (err) {
      console.warn('[CacheService] Failed to save profile to local vault:', err);
    }
  }

  async getProfile(id: string): Promise<any | null> {
    if (!id) return null;
    try {
      const db = await this.db;
      return (await db.get('profiles', id)) || null;
    } catch (err) {
      console.warn('[CacheService] Failed to get profile from local vault:', err);
      return null;
    }
  }

  async clearProfiles(): Promise<void> {
    try {
      const db = await this.db;
      await db.clear('profiles');
    } catch (err) {
      console.warn('[CacheService] Failed to clear profiles in local vault:', err);
    }
  }

  // --- Metrics / Storage Stats ---
  async getDatabaseStats() {
    const db = await this.db;
    const [postsCount, draftsCount, messagesCount, mediaCount, profilesCount] = await Promise.all([
      db.count('feed_posts').catch(() => 0),
      db.count('offline_drafts').catch(() => 0),
      db.count('messages').catch(() => 0),
      db.count('media').catch(() => 0),
      db.count('profiles').catch(() => 0)
    ]);
    return {
      postsCount,
      draftsCount,
      messagesCount,
      mediaCount,
      profilesCount,
      engine: 'SQLite / IndexedDB (Local Vault)'
    };
  }

  async clearAll() {
    const db = await this.db;
    await db.clear('messages');
    await db.clear('media');
    await db.clear('conversations');
    await db.clear('pending_uploads');
    await db.clear('feed_posts');
    await db.clear('offline_drafts');
    await db.clear('profiles');
  }
}

export const aeirmistCache = new CacheService();
