import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserDAL } from '../dal/user.dal';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, optionalAuthToken, AuthenticatedRequest } from '../middleware/auth';
import { assertMediaOwnership } from '../utils/mediaValidator';
import { io } from '../index';
import { broadcastNotification } from './notification.routes';
import { redis } from '../db/redis';

const router = Router();

const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, underscores, and periods').optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().max(255).optional(),
  avatarKey: z.string().optional(),
  bannerKey: z.string().optional(),
  socialLinks: z.any().optional(),
  privacySettings: z.any().optional(),
  // Extended personal info fields
  phoneNumber: z.string().max(20).optional().nullable(),
  phoneCountryCode: z.string().max(10).optional().nullable(),
  dateOfBirth: z.string().max(20).optional().nullable(),
  gender: z.string().max(50).optional().nullable(),
  relationshipStatus: z.string().max(50).optional().nullable(),
  relationshipStatusVisibility: z.string().max(20).optional(),
  pronouns: z.string().max(200).optional().nullable(),
  tagline: z.string().max(150).optional().nullable(),
  fullName: z.string().max(150).optional().nullable(),
  personalEmail: z.string().max(255).optional().nullable(),
  recoveryEmail: z.string().max(255).optional().nullable(),
  recoveryPhone: z.string().max(20).optional().nullable(),
  isProfessional: z.boolean().optional(),
  isProfileLocked: z.boolean().optional(),
  category: z.string().max(50).optional().nullable(),
  themeSettings: z.any().optional(),
  locationData: z.any().optional().nullable(),
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

// Get Current User's Own Profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await UserDAL.getProfileByUserId(req.user!.userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile });
  } catch (err) {
    console.error('[Get My Profile Error]', err);
    res.status(500).json({ error: 'Failed to fetch current user profile' });
  }
});

// Get User Profile by Username, User ID, or Profile ID
router.get('/:identifier', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const identifier = req.params.identifier;
    const cacheKey = `profile_cache:${identifier.toLowerCase()}`;
    let profile: any = null;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        profile = JSON.parse(cached);
      }
    } catch {}

    if (!profile) {
      profile = await UserDAL.getProfileByIdentifier(identifier);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      try {
        await redis.set(cacheKey, JSON.stringify(profile), 'EX', 120); // 2 minutes TTL
      } catch {}
    }

    let isOnline = false;
    let lastSeen: number | null = null;
    try {
      const onlineCheck = (await redis.sismember('online_users', profile.userId)) ||
                          (await redis.sismember('online_users', profile.id)) ||
                          (profile.username ? await redis.sismember('online_users', profile.username) : 0);
      isOnline = Boolean(onlineCheck);
      const lastSeenStr = await redis.get(`last_seen:${profile.userId}`);
      if (lastSeenStr) {
        lastSeen = Number(lastSeenStr);
      }
    } catch {}

    let isFollowing = false;
    if (req.user?.userId && profile.userId && req.user.userId !== profile.userId) {
      try {
        isFollowing = await UserDAL.isFollowing(req.user.userId, profile.userId);
      } catch {}
    }

    const sanitized = { ...profile };
    delete sanitized.email;
    delete sanitized.firebaseUid;

    res.json({
      profile: {
        ...sanitized,
        isOnline,
        isFollowing,
        lastSeen: isOnline ? Date.now() : lastSeen,
      }
    });
  } catch (err) {
    console.error('[Get Profile Error]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update Current User's Profile
router.patch('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);

    if (data.username) {
      const cleanUsername = data.username.toLowerCase().trim().replace(/^@+/, '');
      const existing = await UserDAL.getProfileByUsername(cleanUsername);
      if (existing && existing.userId !== req.user!.userId) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      data.username = cleanUsername;
    }

    if (data.avatarKey) {
      const canUseAvatar = await assertMediaOwnership(data.avatarKey, req.user!.userId);
      if (!canUseAvatar) {
        return res.status(403).json({ error: 'Unauthorized: Avatar asset belongs to another user' });
      }
    }
    if (data.bannerKey) {
      const canUseBanner = await assertMediaOwnership(data.bannerKey, req.user!.userId);
      if (!canUseBanner) {
        return res.status(403).json({ error: 'Unauthorized: Banner asset belongs to another user' });
      }
    }

    const updated = await UserDAL.updateProfile(req.user!.userId, data);
    try {
      if (updated) {
        await Promise.all([
          redis.del(`profile_cache:${req.user!.userId.toLowerCase()}`),
          updated.username ? redis.del(`profile_cache:${updated.username.toLowerCase()}`) : Promise.resolve(),
          updated.id ? redis.del(`profile_cache:${updated.id.toLowerCase()}`) : Promise.resolve(),
        ]);
      }
    } catch {}
    res.json({ profile: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Update Profile Error]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Increment User Points (Rate-limited, max 10 per request, max 50 per day)
router.post('/points', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawPoints = parseInt(req.body.points || '0', 10);
    const pointsToAdd = Math.max(0, Math.min(rawPoints, 10));
    if (pointsToAdd <= 0) {
      return res.json({ success: true, points: 0 });
    }

    const userId = req.user!.userId;
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `user_daily_points:${userId}:${today}`;

    // Atomically increment daily total in Redis and set 24h TTL
    const currentDaily = await redis.incrby(dailyKey, pointsToAdd);
    if (currentDaily === pointsToAdd) {
      await redis.expire(dailyKey, 86400);
    }

    const MAX_DAILY_POINTS = 50;
    if (currentDaily > MAX_DAILY_POINTS) {
      // Revert excess points in Redis
      await redis.decrby(dailyKey, pointsToAdd);
      return res.status(429).json({
        error: 'Daily point accumulation limit reached',
        maxDaily: MAX_DAILY_POINTS
      });
    }

    const updated = await UserDAL.incrementPoints(userId, pointsToAdd);
    return res.json({ success: true, points: updated?.points });
  } catch (err) {
    console.error('[Add Points Error]', err);
    res.status(500).json({ error: 'Failed to update points' });
  }
});

// Follow / Unfollow User
router.post('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const resolvedTargetId = await UserDAL.resolveToUserId(req.params.id);
    if (!resolvedTargetId) {
      return res.status(404).json({ error: 'Target user not found' });
    }
    if (resolvedTargetId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const isFollowing = await UserDAL.isFollowing(req.user!.userId, resolvedTargetId);
    let nextFollowing = false;
    if (isFollowing) {
      await UserDAL.unfollowUser(req.user!.userId, resolvedTargetId);
      nextFollowing = false;
    } else {
      await UserDAL.followUser(req.user!.userId, resolvedTargetId);
      nextFollowing = true;

      // Create notification
      const myProfile = await UserDAL.getProfileByUserId(req.user!.userId);
      const notif = await NotificationDAL.create({
        recipientId: resolvedTargetId,
        actorId: req.user!.userId,
        type: 'follow',
        title: 'New Follower',
        body: `${myProfile?.displayName || myProfile?.username || 'Someone'} started following you.`,
        actionUrl: `/profile/${myProfile?.username}`,
      });

      // Realtime push notification via WebSockets
      await broadcastNotification(resolvedTargetId, notif);
    }

    // Invalidate profile caches in Redis
    try {
      const myProfile = await UserDAL.getProfileByUserId(req.user!.userId);
      const targetProfile = await UserDAL.getProfileByUserId(resolvedTargetId);
      const keysToClear = [
        `profile_cache:${req.user!.userId.toLowerCase()}`,
        `profile_cache:${resolvedTargetId.toLowerCase()}`,
        myProfile?.username ? `profile_cache:${myProfile.username.toLowerCase()}` : null,
        targetProfile?.username ? `profile_cache:${targetProfile.username.toLowerCase()}` : null,
        myProfile?.id ? `profile_cache:${myProfile.id.toLowerCase()}` : null,
        targetProfile?.id ? `profile_cache:${targetProfile.id.toLowerCase()}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToClear) {
        await redis.del(k);
      }
    } catch {}

    const updatedTargetProfile = await UserDAL.getProfileByUserId(resolvedTargetId);

    // Emit live socket event
    try {
      io.emit('user_follow_updated', {
        targetUserId: resolvedTargetId,
        followerUserId: req.user!.userId,
        isFollowing: nextFollowing,
        followersCount: updatedTargetProfile?.followersCount ?? 0,
      });
    } catch {}

    return res.json({
      following: nextFollowing,
      followersCount: updatedTargetProfile?.followersCount ?? 0,
      followingCount: updatedTargetProfile?.followingCount ?? 0,
    });
  } catch (err) {
    console.error('[Follow Error]', err);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

// Get User Followers List
router.get('/:id/followers', async (req: Request, res: Response) => {
  try {
    const resolvedId = await UserDAL.resolveToUserId(req.params.id);
    if (!resolvedId) return res.status(404).json({ error: 'User not found' });
    const followers = await UserDAL.getFollowers(resolvedId);
    res.json({ followers });
  } catch (err) {
    console.error('[Get Followers Error]', err);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get User Following List
router.get('/:id/following', async (req: Request, res: Response) => {
  try {
    const resolvedId = await UserDAL.resolveToUserId(req.params.id);
    if (!resolvedId) return res.status(404).json({ error: 'User not found' });
    const following = await UserDAL.getFollowing(resolvedId);
    res.json({ following });
  } catch (err) {
    console.error('[Get Following Error]', err);
    res.status(500).json({ error: 'Failed to fetch following' });
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

// Presence status update (device server native presence)
router.post('/presence', async (req: any, res: Response) => {
  try {
    let userId = req.user?.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const { verifyAccessToken } = await import('../lib/auth');
          const payload = verifyAccessToken(token);
          if (payload) userId = payload.userId;
        } catch {}
      }
    }

    if (!userId) {
      return res.status(200).json({ ok: true });
    }

    const { status } = req.body || {};
    const effectiveStatus = status === 'offline' ? 'offline' : 'online';
    const now = Date.now();

    const u = await UserDAL.findById(userId);
    const p = await UserDAL.getProfileByUserId(userId);

    if (effectiveStatus === 'online') {
      await redis.sadd('online_users', userId);
      if (u?.firebaseUid) await redis.sadd('online_users', u.firebaseUid);
      if (p?.id) await redis.sadd('online_users', p.id);
      if (p?.username) await redis.sadd('online_users', p.username);
      await redis.set(`last_seen:${userId}`, now);
    } else {
      await redis.srem('online_users', userId);
      if (u?.firebaseUid) await redis.srem('online_users', u.firebaseUid);
      if (p?.id) await redis.srem('online_users', p.id);
      if (p?.username) await redis.srem('online_users', p.username);
      await redis.set(`last_seen:${userId}`, now);
    }

    io.emit('user_status', {
      userId,
      firebaseUid: u?.firebaseUid,
      profileId: p?.id,
      username: p?.username,
      status: effectiveStatus,
      lastSeen: now,
    });

    res.json({ success: true, status: effectiveStatus });
  } catch (err) {
    res.status(200).json({ ok: true });
  }
});

export default router;

