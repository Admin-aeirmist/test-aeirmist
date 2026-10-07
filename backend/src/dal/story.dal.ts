import { db } from '../db';
import { stories, storyHighlights, users, profiles } from '../db/schema';
import { eq, gt, desc, and } from 'drizzle-orm';

export interface CreateStoryDTO {
  userId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType?: string;
  caption?: string;
  audience?: string;
  expiresAt: Date;
}

export class StoryDAL {
  static async create(data: CreateStoryDTO) {
    const [story] = await db
      .insert(stories)
      .values({
        userId: data.userId,
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaType: data.mediaType || 'image',
        caption: data.caption,
        audience: data.audience || 'public',
        expiresAt: data.expiresAt,
      })
      .returning();
    return story;
  }

  static async getActiveStories() {
    const now = new Date();
    const rows = await db
      .select({
        id: stories.id,
        userId: stories.userId,
        mediaUrl: stories.mediaUrl,
        thumbnailUrl: stories.thumbnailUrl,
        mediaType: stories.mediaType,
        caption: stories.caption,
        audience: stories.audience,
        viewers: stories.viewers,
        createdAt: stories.createdAt,
        expiresAt: stories.expiresAt,
        author: {
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(stories)
      .innerJoin(users, eq(stories.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(gt(stories.expiresAt, now))
      .orderBy(desc(stories.createdAt));

    return rows;
  }

  static async getArchive(userId: string) {
    const rows = await db
      .select()
      .from(stories)
      .where(eq(stories.userId, userId))
      .orderBy(desc(stories.createdAt));

    return rows;
  }

  static async recordView(storyId: string, viewerUserId: string) {
    const [existing] = await db
      .select({ viewers: stories.viewers })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    if (!existing) return false;

    const viewersList = Array.isArray(existing.viewers) ? existing.viewers : [];
    if (!viewersList.includes(viewerUserId)) {
      viewersList.push(viewerUserId);
      await db
        .update(stories)
        .set({ viewers: viewersList })
        .where(eq(stories.id, storyId));
    }
    return true;
  }

  // Highlights
  static async createHighlight(userId: string, title: string, coverUrl?: string, storyIds: string[] = []) {
    const [highlight] = await db
      .insert(storyHighlights)
      .values({
        userId,
        title,
        coverUrl,
        storyIds,
      })
      .returning();
    return highlight;
  }

  static async getUserHighlights(userId: string) {
    return await db
      .select()
      .from(storyHighlights)
      .where(eq(storyHighlights.userId, userId))
      .orderBy(desc(storyHighlights.createdAt));
  }

  static async deleteHighlight(highlightId: string, userId: string) {
    const [deleted] = await db
      .delete(storyHighlights)
      .where(and(eq(storyHighlights.id, highlightId), eq(storyHighlights.userId, userId)))
      .returning();
    return !!deleted;
  }

  static async deleteStory(storyId: string, userId: string) {
    const [deleted] = await db
      .delete(stories)
      .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
      .returning();
    return !!deleted;
  }
}
