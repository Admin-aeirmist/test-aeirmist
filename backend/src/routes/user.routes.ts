import { Router, Response } from 'express';
import { z } from 'zod';
import { UserDAL } from '../dal/user.dal';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  avatarKey: z.string().optional(),
  bannerKey: z.string().optional(),
  socialLinks: z.any().optional(),
  privacySettings: z.any().optional(),
});

// Search Users
router.get('/search', async (req, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    const results = await UserDAL.searchUsers(q, limit);
    res.json({ users: results });
  } catch (err) {
    console.error('[Search Users Error]', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Follow Suggestions
router.get('/suggestions', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    const results = await UserDAL.getSuggestedUsers(undefined, limit);
    res.json({ users: results });
  } catch (err) {
    console.error('[Suggestions Error]', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Get User Profile by Username, User ID, or Profile ID
router.get('/:identifier', async (req, res: Response) => {
  try {
    const identifier = req.params.identifier;
    const profile = await UserDAL.getProfileByIdentifier(identifier);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile });
  } catch (err) {
    console.error('[Get Profile Error]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update Current User's Profile
router.patch('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    const updated = await UserDAL.updateProfile(req.user!.userId, data);
    res.json({ profile: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Update Profile Error]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Increment User Points
router.post('/points', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pointsToAdd = Math.max(0, Math.min(parseInt(req.body.points || '0', 10), 1000));
    if (pointsToAdd > 0) {
      const updated = await UserDAL.incrementPoints(req.user!.userId, pointsToAdd);
      return res.json({ success: true, points: updated?.points });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Add Points Error]', err);
    res.status(500).json({ error: 'Failed to update points' });
  }
});

// Follow / Unfollow User
router.post('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const isFollowing = await UserDAL.isFollowing(req.user!.userId, targetUserId);
    if (isFollowing) {
      await UserDAL.unfollowUser(req.user!.userId, targetUserId);
      return res.json({ following: false });
    } else {
      await UserDAL.followUser(req.user!.userId, targetUserId);

      // Create notification
      const myProfile = await UserDAL.getProfileByUserId(req.user!.userId);
      const notif = await NotificationDAL.create({
        recipientId: targetUserId,
        actorId: req.user!.userId,
        type: 'follow',
        title: 'New Follower',
        body: `${myProfile?.displayName || myProfile?.username || 'Someone'} started following you.`,
        actionUrl: `/profile/${myProfile?.username}`,
      });

      // Realtime push notification via WebSockets
      io.to(`user:${targetUserId}`).emit('new_notification', { notification: notif });

      return res.json({ following: true });
    }
  } catch (err) {
    console.error('[Follow Error]', err);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

// Deactivate Account
router.post('/deactivate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await UserDAL.deactivateAccount(req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('[Deactivate Error]', err);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

// Self Delete Account
router.delete('/account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await UserDAL.purgeUser(req.user!.userId);
    res.json({ success, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[Delete Account Error]', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;

