import { Router, Response } from 'express';
import { z } from 'zod';
import { PostDAL } from '../dal/post.dal';
import { CommentDAL } from '../dal/comment.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

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
    const isLiked = await PostDAL.likePost(req.params.id, req.user!.userId);
    if (!isLiked) {
      // Toggle to unlike if already liked
      await PostDAL.unlikePost(req.params.id, req.user!.userId);
      return res.json({ liked: false });
    }
    res.json({ liked: true });
  } catch (err) {
    console.error('[Like Error]', err);
    res.status(500).json({ error: 'Failed to toggle like' });
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
    const data = AddCommentSchema.parse(req.body);
    const comment = await CommentDAL.addComment({
      postId: req.params.id,
      userId: req.user!.userId,
      content: data.content,
      parentId: data.parentId,
    });
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
