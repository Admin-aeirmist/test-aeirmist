import { Router, Response } from 'express';
import { z } from 'zod';
import { CallsDAL } from '../dal/calls.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const LogCallSchema = z.object({
  receiverId: z.string().min(1),
  type: z.enum(['audio', 'video']).default('video'),
  status: z.enum(['calling', 'ongoing', 'ended', 'rejected', 'missed', 'busy']).default('calling'),
  duration: z.number().optional(),
});

// Get call history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const history = await CallsDAL.getCallHistory(req.user!.userId, limit);
    res.json({ calls: history });
  } catch (err) {
    console.error('[Call History Error]', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// Log new call
router.post('/log', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = LogCallSchema.parse(req.body);
    const call = await CallsDAL.logCall({
      callerId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ call });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Log Call Error]', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// Update call status
router.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, duration } = req.body;
    const call = await CallsDAL.updateCallStatus(req.params.id, status, duration);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    res.json({ call });
  } catch (err) {
    console.error('[Update Call Status Error]', err);
    res.status(500).json({ error: 'Failed to update call status' });
  }
});

export default router;
