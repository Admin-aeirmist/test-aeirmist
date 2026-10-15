import { Router, Response } from 'express';
import { z } from 'zod';
import { NotificationDAL } from '../dal/notification.dal';
import { UserDAL } from '../dal/user.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

const ALLOWED_NOTIFICATION_TYPES = [
  'message',
  'follow',
  'follow_request',
  'follow_back',
  'follow_accept',
  'like',
  'comment_like',
  'comment',
  'comment_reply',
  'reply_to_reply',
  'mention',
  'ngl_received',
  'verification',
  'call',
  'system',
  'general',
] as const;

const CreateNotificationSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  type: z.string().min(1).max(50).default('general'),
  title: z.string().max(200).default(''),
  body: z.string().max(1000).default(''),
  actionUrl: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserId(rawId: string): Promise<string | null> {
  const resolved = await UserDAL.resolveToUserId(rawId);
  if (resolved && UUID_REGEX.test(resolved)) {
    return resolved;
  }
  return null;
}

export async function broadcastNotification(userId: string, notification: any) {
  try {
    io.to(`user:${userId}`).emit('new_notification', { notification });
    const targetUser = await UserDAL.findById(userId);
    if (targetUser?.firebaseUid) {
      io.to(`user:${targetUser.firebaseUid}`).emit('new_notification', { notification });
    }
    const targetProfile = await UserDAL.getProfileByUserId(userId);
    if (targetProfile?.id) {
      io.to(`user:${targetProfile.id}`).emit('new_notification', { notification });
    }
    // Fire web push for offline delivery
    try {
      const { sendPushToUser } = await import('../utils/webPush');
      sendPushToUser(userId, {
        title: notification.title || 'Aeirmist',
        body: notification.body || '',
        url: notification.actionUrl || '/',
        tag: notification.type || 'aeirmist_push',
      }).catch(() => {});
    } catch {}
  } catch (e) {}
}

// Create Notification
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateNotificationSchema.parse(req.body);
    const targetUserId = await resolveUserId(data.recipientId);
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid recipient identifier' });
    }

    const notif = await NotificationDAL.create({
      recipientId: targetUserId,
      actorId: req.user!.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
    });
    await broadcastNotification(targetUserId, notif);
    res.status(201).json({ notification: notif });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Create Notification Error]', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get Notifications
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const list = await NotificationDAL.getUserNotifications(req.user!.userId, limit);
    const unreadCount = await NotificationDAL.getUnreadCount(req.user!.userId);
    res.json({ notifications: list, unreadCount });
  } catch (err) {
    console.error('[Get Notifications Error]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark Single Notification as Read
router.post('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await NotificationDAL.markAsRead(req.params.id, req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('[Mark Notification Read Error]', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark All Notifications as Read
router.post('/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NotificationDAL.markAllAsRead(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Mark All Read Error]', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete Notification
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await NotificationDAL.delete(req.params.id, req.user!.userId);
    res.json({ success });
  } catch (err) {
    console.error('[Delete Notification Error]', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Push Subscription Management
router.post('/push/subscribe', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }
    const { pushSubscriptions } = await import('../db/schema');
    const { db: database } = await import('../db');
    await database.insert(pushSubscriptions).values({
      userId: req.user!.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }).onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    console.error('[Push Subscribe Error]', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

router.delete('/push/unsubscribe', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    const { pushSubscriptions } = await import('../db/schema');
    const { db: database } = await import('../db');
    const { and, eq } = await import('drizzle-orm');
    await database.delete(pushSubscriptions).where(
      and(eq(pushSubscriptions.userId, req.user!.userId), eq(pushSubscriptions.endpoint, endpoint))
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Push Unsubscribe Error]', err);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

router.get('/push/vapid-key', (_req, res: Response) => {
  try {
    const { VAPID_PUBLIC } = require('../utils/webPush');
    res.json({ publicKey: VAPID_PUBLIC });
  } catch {
    res.json({ publicKey: null });
  }
});

export default router;

