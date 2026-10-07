import { Router, Response } from 'express';
import { NotificationDAL } from '../dal/notification.dal';
import { UserDAL } from '../dal/user.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

async function resolveUserId(rawId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
  if (isUuid) return rawId;
  const user = await UserDAL.findByEmailOrUsername(rawId) || await UserDAL.findByFirebaseUid(rawId);
  return user?.id || rawId;
}

// Create Notification
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientId, type, title, body, actionUrl, metadata } = req.body;
    const targetUserId = await resolveUserId(recipientId);
    const notif = await NotificationDAL.create({
      recipientId: targetUserId,
      actorId: req.user!.userId,
      type: type || 'general',
      title: title || '',
      body: body || '',
      actionUrl,
      metadata,
    });
    try {
      io.to(`user:${targetUserId}`).emit('new_notification', notif);
    } catch (e) {}
    res.status(201).json({ notification: notif });
  } catch (err) {
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

export default router;
