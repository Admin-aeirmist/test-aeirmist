import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { videos, videoLikes, videoComments, users, profiles } from '../db/schema';

export class VideoDAL {
  static async getFeed(limit: number = 20, offset: number = 0, viewerId?: string) {
    const rows = await db
      .select({
        video: videos,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(videos.isPublished, true))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    if (!viewerId) {
      return rows.map((r) => ({ ...r.video, author: r.author, isLiked: false }));
    }

    const videoIds = rows.map((r) => r.video.id);
    if (videoIds.length === 0) return [];

    const likedRows = await db
      .select({ videoId: videoLikes.videoId })
      .from(videoLikes)
      .where(eq(videoLikes.userId, viewerId));

    const likedSet = new Set(likedRows.map((l) => l.videoId));

    return rows.map((r) => ({
      ...r.video,
      author: r.author,
      isLiked: likedSet.has(r.video.id),
    }));
  }

  static async getById(videoId: string, viewerId?: string) {
    const [row] = await db
      .select({
        video: videos,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!row) return null;

    let isLiked = false;
    if (viewerId) {
      const [like] = await db
        .select()
        .from(videoLikes)
        .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, viewerId)))
        .limit(1);
      isLiked = !!like;
    }

    return {
      ...row.video,
      author: row.author,
      isLiked,
    };
  }

  static async create(data: {
    userId: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    mediaKey?: string;
    duration?: number;
    category?: string;
    tags?: string[];
  }) {
    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: data.userId,
        title: data.title,
        description: data.description,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaKey: data.mediaKey,
        duration: data.duration || 0,
        category: data.category || 'General',
        tags: data.tags || [],
      })
      .returning();

    return newVideo;
  }

  static async likeVideo(videoId: string, userId: string) {
    const [existing] = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, userId)))
      .limit(1);

    if (existing) return false;

    await db.insert(videoLikes).values({ videoId, userId });
    await db
      .update(videos)
      .set({ likesCount: sql`${videos.likesCount} + 1` })
      .where(eq(videos.id, videoId));

    return true;
  }

  static async unlikeVideo(videoId: string, userId: string) {
    const [removed] = await db
      .delete(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, userId)))
      .returning();

    if (!removed) return false;

    await db
      .update(videos)
      .set({ likesCount: sql`GREATEST(0, ${videos.likesCount} - 1)` })
      .where(eq(videos.id, videoId));

    return true;
  }

  static async incrementViews(videoId: string) {
    await db
      .update(videos)
      .set({ viewsCount: sql`${videos.viewsCount} + 1` })
      .where(eq(videos.id, videoId));
  }

  static async addComment(videoId: string, userId: string, content: string) {
    const [comment] = await db
      .insert(videoComments)
      .values({ videoId, userId, content })
      .returning();

    await db
      .update(videos)
      .set({ commentsCount: sql`${videos.commentsCount} + 1` })
      .where(eq(videos.id, videoId));

    const [author] = await db
      .select({
        id: users.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
      })
      .from(users)
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(users.id, userId))
      .limit(1);

    return { ...comment, author };
  }

  static async getComments(videoId: string, limit: number = 50, offset: number = 0) {
    const rows = await db
      .select({
        comment: videoComments,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
        },
      })
      .from(videoComments)
      .innerJoin(users, eq(videoComments.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(videoComments.videoId, videoId))
      .orderBy(desc(videoComments.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({ ...r.comment, author: r.author }));
  }

  static async deleteVideo(videoId: string, userId: string, isAdmin: boolean = false) {
    const [video] = await db
      .select({ id: videos.id, userId: videos.userId })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) return false;
    if (video.userId !== userId && !isAdmin) return false;

    await db.delete(videos).where(eq(videos.id, videoId));
    return true;
  }
}
