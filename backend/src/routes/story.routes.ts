import { Router, Response } from 'express';
import { z } from 'zod';
import { StoryDAL } from '../dal/story.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const CreateStorySchema = z.object({
  mediaUrl: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  mediaType: z.string().default('image'),
  caption: z.string().max(1000).optional(),
  audience: z.enum(['public', 'followers', 'closeFriends']).default('public'),
});

// Get Active Stories
router.get('/', async (_req, res: Response) => {
  try {
    const list = await StoryDAL.getActiveStories();
    res.json({ stories: list });
  } catch (err) {
    console.error('[Get Stories Error]', err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create Story (expires in 24 hours)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateStorySchema.parse(req.body);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await StoryDAL.create({
      userId: req.user!.userId,
      mediaUrl: data.mediaUrl,
      thumbnailUrl: data.thumbnailUrl,
      mediaType: data.mediaType,
      caption: data.caption,
      audience: data.audience,
      expiresAt,
    });

    res.status(201).json({ story });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Create Story Error]', err);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Record Story View
router.post('/:id/view', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await StoryDAL.recordView(req.params.id, req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('[Record View Error]', err);
    res.status(500).json({ error: 'Failed to record story view' });
  }
});

export default router;
