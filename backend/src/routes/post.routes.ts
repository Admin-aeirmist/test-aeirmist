import { Router, Response } from 'express';
import { z } from 'zod';
import { PostDAL } from '../dal/post.dal';
import { CommentDAL } from '../dal/comment.dal';
import { UserDAL } from '../dal/user.dal';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

const CreatePostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaKeys: z.array(z.string()).optional(),
  mediaType: z.enum(['none', 'image', 'video', 'collage']).optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  pollData: z.any().optional(),
});

const AddCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

async function resolveUserId(rawId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
  if (isUuid) return rawId;
  const user = await UserDAL.findByEmailOrUsername(rawId) || await UserDAL.findByFirebaseUid(rawId);
  return user?.id || rawId;
}

// Feed
router.get('/', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const feed = await PostDAL.getFeed(undefined, limit, offset);
    res.json({ posts: feed });
  } catch (err) {
    console.error('[Feed Error]', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// User Posts
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const targetUserId = await resolveUserId(req.params.userId);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const list = await PostDAL.getUserPosts(targetUserId, limit, offset);
    res.json({ posts: list });
  } catch (err) {
    console.error('[User Posts Error]', err);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Create Post
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreatePostSchema.parse(req.body);
    const post = await PostDAL.createPost({
      userId: req.user!.userId,
      content: data.content,
      mediaKeys: data.mediaKeys,
      mediaType: data.mediaType,
      tags: data.tags,
      location: data.location,
      pollData: data.pollData,
    });
    res.status(201).json({ post });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Create Post Error]', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get Single Post
router.get('/:id', async (req, res: Response) => {
  try {
    const post = await PostDAL.getById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ post });
  } catch (err) {
    console.error('[Get Post Error]', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Delete Post
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'owner'].includes(req.user!.role);
    const success = await PostDAL.deletePost(req.params.id, req.user!.userId, isAdmin);
    if (!success) {
      return res.status(403).json({ error: 'Unauthorized to delete this post or post not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Post Error]', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Like / Unlike Post
router.post('/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await PostDAL.getById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const isLiked = await PostDAL.likePost(req.params.id, req.user!.userId);
    let liked = true;
    if (!isLiked) {
      await PostDAL.unlikePost(req.params.id, req.user!.userId);
      liked = false;
    } else if (post.userId !== req.user!.userId) {
      // Trigger notification
      const myProfile = await UserDAL.getProfileByUserId(req.user!.userId);
      const notif = await NotificationDAL.create({
        recipientId: post.userId,
        actorId: req.user!.userId,
        type: 'like',
        title: 'New Like',
        body: `${myProfile?.displayName || myProfile?.username || 'Someone'} liked your post.`,
        actionUrl: `/post/${post.id}`,
      });
      io.to(`user:${post.userId}`).emit('new_notification', { notification: notif });
    }

    const updated = await PostDAL.getById(req.params.id);
    res.json({ liked, likesCount: updated?.likesCount || 0 });
  } catch (err) {
    console.error('[Like Error]', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Bookmark / Unbookmark Post
router.post('/:id/bookmark', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isBookmarked = await PostDAL.bookmarkPost(req.params.id, req.user!.userId);
    let bookmarked = true;
    if (!isBookmarked) {
      await PostDAL.unbookmarkPost(req.params.id, req.user!.userId);
      bookmarked = false;
    }
    res.json({ bookmarked });
  } catch (err) {
    console.error('[Bookmark Error]', err);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

// Comments on Post
router.get('/:id/comments', async (req, res: Response) => {
  try {
    const comments = await CommentDAL.getCommentsByPostId(req.params.id);
    res.json({ comments });
  } catch (err) {
    console.error('[Get Comments Error]', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await PostDAL.getById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const data = AddCommentSchema.parse(req.body);
    const comment = await CommentDAL.addComment({
      postId: req.params.id,
      userId: req.user!.userId,
      content: data.content,
      parentId: data.parentId,
    });

    if (post.userId !== req.user!.userId) {
      const myProfile = await UserDAL.getProfileByUserId(req.user!.userId);
      const notif = await NotificationDAL.create({
        recipientId: post.userId,
        actorId: req.user!.userId,
        type: 'comment',
        title: 'New Comment',
        body: `${myProfile?.displayName || myProfile?.username || 'Someone'} commented on your post: "${data.content.slice(0, 30)}..."`,
        actionUrl: `/post/${post.id}`,
      });
      io.to(`user:${post.userId}`).emit('new_notification', { notification: notif });
    }

    res.status(201).json({ comment });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Add Comment Error]', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
