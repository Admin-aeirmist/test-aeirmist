import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { comments, commentLikes, posts, profiles, users } from '../db/schema';

export class CommentDAL {
  static async addComment(data: {
    postId: string;
    userId: string;
    content: string;
    parentId?: string;
  }) {
    const [newComment] = await db
      .insert(comments)
      .values({
        postId: data.postId,
        userId: data.userId,
        content: data.content,
        parentId: data.parentId,
      })
      .returning();

    // Increment post comments count
    await db
      .update(posts)
      .set({ commentsCount: sql`${posts.commentsCount} + 1` })
      .where(eq(posts.id, data.postId));

    // If it's a reply, increment parent's reply count
    if (data.parentId) {
      await db
        .update(comments)
        .set({ repliesCount: sql`${comments.repliesCount} + 1` })
        .where(eq(comments.id, data.parentId));
    }

    return newComment;
  }

  static async getCommentsByPostId(postId: string, limit: number = 50, offset: number = 0) {
    const rows = await db
      .select({
        comment: comments,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      ...r.comment,
      author: r.author,
    }));
  }

  static async likeComment(commentId: string, userId: string) {
    const [like] = await db
      .insert(commentLikes)
      .values({ commentId, userId })
      .onConflictDoNothing()
      .returning();

    if (like) {
      await db
        .update(comments)
        .set({ likesCount: sql`${comments.likesCount} + 1` })
        .where(eq(comments.id, commentId));
    }
    return !!like;
  }

  static async deleteComment(commentId: string, userId: string, isAdmin: boolean = false) {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!comment) return false;
    if (comment.userId !== userId && !isAdmin) return false;

    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, commentId));

    await db
      .update(posts)
      .set({ commentsCount: sql`GREATEST(0, ${posts.commentsCount} - 1)` })
      .where(eq(posts.id, comment.postId));

    return true;
  }
}
