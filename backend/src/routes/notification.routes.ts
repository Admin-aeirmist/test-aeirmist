import { Router, Response } from 'express';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

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
