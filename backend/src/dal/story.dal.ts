import { db } from '../db';
import { stories, users, profiles } from '../db/schema';
import { eq, gt, desc } from 'drizzle-orm';

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
}
