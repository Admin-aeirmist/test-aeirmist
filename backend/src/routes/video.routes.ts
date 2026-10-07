import { Router, Response } from 'express';
import { z } from 'zod';
import { VideoDAL } from '../dal/video.dal';
import { authenticateToken, optionalAuthToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const CreateVideoSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(5000).optional(),
  videoUrl: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  mediaKey: z.string().optional(),
  duration: z.number().optional(),
  category: z.string().max(64).optional(),
  tags: z.array(z.string()).optional(),
});

const CommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

// Video Feed (available on / and /feed)
router.get(['/', '/feed'], optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const viewerId = req.user?.userId;

    const feed = await VideoDAL.getFeed(limit, offset, viewerId);
    res.json({ videos: feed });
  } catch (err) {
    console.error('[Video Feed Error]', err);
    res.status(500).json({ error: 'Failed to fetch video feed' });
  }
});

// Single Video
router.get('/:id', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id);
    if (!isUuid) {
      return res.status(404).json({ error: 'Video not found' });
    }
    const viewerId = req.user?.userId;
    const video = await VideoDAL.getById(req.params.id, viewerId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json({ video });
  } catch (err) {
    console.error('[Video Details Error]', err);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// Create / Upload Video
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateVideoSchema.parse(req.body);
    const video = await VideoDAL.create({
      userId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ video });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Video Create Error]', err);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// Like Video
router.post('/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await VideoDAL.likeVideo(req.params.id, req.user!.userId);
    res.json({ success, isLiked: true });
  } catch (err) {
    console.error('[Video Like Error]', err);
    res.status(500).json({ error: 'Failed to like video' });
  }
});

// Unlike Video
router.delete('/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await VideoDAL.unlikeVideo(req.params.id, req.user!.userId);
    res.json({ success, isLiked: false });
  } catch (err) {
    console.error('[Video Unlike Error]', err);
    res.status(500).json({ error: 'Failed to unlike video' });
  }
});

// Record View
router.post('/:id/view', async (req, res: Response) => {
  try {
    await VideoDAL.incrementViews(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Get Video Comments
router.get('/:id/comments', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const comments = await VideoDAL.getComments(req.params.id, limit, offset);
    res.json({ comments });
  } catch (err) {
    console.error('[Video Comments Error]', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add Video Comment
router.post('/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CommentSchema.parse(req.body);
    const comment = await VideoDAL.addComment(req.params.id, req.user!.userId, data.content);
    res.status(201).json({ comment });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Add Comment Error]', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete Video
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'owner'].includes(req.user!.role);
    const success = await VideoDAL.deleteVideo(req.params.id, req.user!.userId, isAdmin);
    if (!success) {
      return res.status(403).json({ error: 'Unauthorized or video not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Video Error]', err);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
