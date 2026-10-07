import { Router, Response } from 'express';
import { z } from 'zod';
import { NotesDAL } from '../dal/notes.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const NoteSchema = z.object({
  text: z.string().min(1).max(120),
  emoji: z.string().max(16).optional(),
});

// Get active notes
router.get('/', async (_req, res: Response) => {
  try {
    const notes = await NotesDAL.getActiveNotes();
    res.json({ notes });
  } catch (err) {
    console.error('[Get Notes Error]', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Post / update note
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = NoteSchema.parse(req.body);
    const note = await NotesDAL.setNote(req.user!.userId, data.text, data.emoji);
    res.status(201).json({ note });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Set Note Error]', err);
    res.status(500).json({ error: 'Failed to set note' });
  }
});

// Delete note
router.delete('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NotesDAL.deleteNote(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Note Error]', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
