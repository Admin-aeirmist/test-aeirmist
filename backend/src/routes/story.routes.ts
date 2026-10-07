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

const CreateHighlightSchema = z.object({
  title: z.string().min(1).max(100),
  coverUrl: z.string().optional(),
  storyIds: z.array(z.string()).default([]),
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

// Get User Story Archive
router.get('/archive', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await StoryDAL.getArchive(req.user!.userId);
    res.json({ stories: list });
  } catch (err) {
    console.error('[Get Archive Error]', err);
    res.status(500).json({ error: 'Failed to fetch story archive' });
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

// ---------------- Story Highlights ----------------
router.get('/highlights/:userId', async (req, res: Response) => {
  try {
    const highlights = await StoryDAL.getUserHighlights(req.params.userId);
    res.json({ highlights });
  } catch (err) {
    console.error('[Get Highlights Error]', err);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

router.post('/highlights', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateHighlightSchema.parse(req.body);
    const highlight = await StoryDAL.createHighlight(
      req.user!.userId,
      data.title,
      data.coverUrl,
      data.storyIds
    );
    res.status(201).json({ highlight });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Create Highlight Error]', err);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
});

router.delete('/highlights/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await StoryDAL.deleteHighlight(req.params.id, req.user!.userId);
    if (!success) {
      return res.status(404).json({ error: 'Highlight not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Highlight Error]', err);
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

// Delete Single Story
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await StoryDAL.deleteStory(req.params.id, req.user!.userId);
    if (!success) {
      return res.status(404).json({ error: 'Story not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Story Error]', err);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
