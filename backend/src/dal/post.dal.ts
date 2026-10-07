import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { posts, postLikes, postBookmarks, profiles, users, pollVotes } from '../db/schema';

export class PostDAL {
  static async createPost(data: {
    userId: string;
    content: string;
    mediaKeys?: string[];
    mediaType?: string;
    visibility?: string;
    tags?: string[];
    location?: string;
    pollData?: any;
  }) {
    const [newPost] = await db
      .insert(posts)
      .values({
        userId: data.userId,
        content: data.content,
        mediaKeys: data.mediaKeys || [],
        mediaType: data.mediaType || 'none',
        visibility: data.visibility || 'public',
        tags: data.tags || [],
        location: data.location,
        pollData: data.pollData,
      })
      .returning();

    // Increment profile posts count
    await db
      .update(profiles)
      .set({ postsCount: sql`${profiles.postsCount} + 1` })
      .where(eq(profiles.userId, data.userId));

    return newPost;
  }

  static async getById(postId: string, viewerId?: string) {
    const [row] = await db
      .select({
        post: posts,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);

    if (!row) return null;

    let isLiked = false;
    let isBookmarked = false;

    if (viewerId) {
      const [like] = await db
        .select()
        .from(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewerId)))
        .limit(1);
      isLiked = !!like;

      const [bookmark] = await db
        .select()
        .from(postBookmarks)
        .where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.userId, viewerId)))
        .limit(1);
      isBookmarked = !!bookmark;
    }

    return {
      ...row.post,
      author: row.author,
      isLiked,
      isBookmarked,
    };
  }

  static async getFeed(viewerId?: string, limit: number = 20, offset: number = 0) {
    const rows = await db
      .select({
        post: posts,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(isNull(posts.deletedAt))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      ...r.post,
      author: r.author,
    }));
  }

  static async getUserPosts(targetUserId: string, limit: number = 50, offset: number = 0) {
    const rows = await db
      .select({
        post: posts,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(posts.userId, targetUserId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      ...r.post,
      author: r.author,
    }));
  }

  static async likePost(postId: string, userId: string) {
    const [like] = await db
      .insert(postLikes)
      .values({ postId, userId })
      .onConflictDoNothing()
      .returning();

    if (like) {
      await db
        .update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.id, postId));
    }
    return !!like;
  }

  static async unlikePost(postId: string, userId: string) {
    const [removed] = await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .returning();

    if (removed) {
      await db
        .update(posts)
        .set({ likesCount: sql`GREATEST(0, ${posts.likesCount} - 1)` })
        .where(eq(posts.id, postId));
    }
    return !!removed;
  }

  static async bookmarkPost(postId: string, userId: string) {
    const [bookmark] = await db
      .insert(postBookmarks)
      .values({ postId, userId })
      .onConflictDoNothing()
      .returning();
    return !!bookmark;
  }

  static async unbookmarkPost(postId: string, userId: string) {
    const [removed] = await db
      .delete(postBookmarks)
      .where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.userId, userId)))
      .returning();
    return !!removed;
  }

  static async deletePost(postId: string, userId: string, isAdmin: boolean = false) {
    const [post] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) return false;
    if (post.userId !== userId && !isAdmin) return false;

    await db
      .update(posts)
      .set({ deletedAt: new Date() })
      .where(eq(posts.id, postId));

    await db
      .update(profiles)
      .set({ postsCount: sql`GREATEST(0, ${profiles.postsCount} - 1)` })
      .where(eq(profiles.userId, post.userId));

    return true;
  }

  static async votePoll(postId: string, userId: string, optionIndex: number) {
    const [post] = await db
      .select({ id: posts.id, pollData: posts.pollData })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post || !post.pollData) return null;

    const [existing] = await db
      .select()
      .from(pollVotes)
      .where(and(eq(pollVotes.postId, postId), eq(pollVotes.userId, userId)))
      .limit(1);

    if (existing) {
      return { alreadyVoted: true, pollData: post.pollData };
    }

    await db.insert(pollVotes).values({ postId, userId, optionIndex });

    const poll = { ...(post.pollData as any) };
    if (poll.options && poll.options[optionIndex]) {
      poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
      poll.totalVotes = (poll.totalVotes || 0) + 1;
      await db.update(posts).set({ pollData: poll }).where(eq(posts.id, postId));
    }

    return { success: true, pollData: poll };
  }
}
