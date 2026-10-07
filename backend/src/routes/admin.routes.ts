import { Router, Response } from 'express';
import { db } from '../db';
import { users, profiles, posts, messages, marketplaceItems, auditLogs } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware: Admin check
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || !['admin', 'super_admin', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Administrative privileges required' });
  }
  next();
};

// Admin Platform Stats
router.get('/stats', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [postCount] = await db.select({ count: sql<number>`count(*)::int` }).from(posts);
    const [messageCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messages);
    const [marketCount] = await db.select({ count: sql<number>`count(*)::int` }).from(marketplaceItems);

    res.json({
      stats: {
        totalUsers: userCount?.count || 0,
        totalPosts: postCount?.count || 0,
        totalMessages: messageCount?.count || 0,
        totalMarketplaceItems: marketCount?.count || 0,
      },
    });
  } catch (err) {
    console.error('[Admin Stats Error]', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Ban / Unban User
router.post('/users/:id/ban', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { reason, ban } = req.body;

    const newStatus = ban ? 'BANNED' : 'ACTIVE';
    await db.update(users).set({ status: newStatus }).where(eq(users.id, targetUserId));

    // Audit log
    await db.insert(auditLogs).values({
      actorId: req.user!.userId,
      action: ban ? 'USER_BAN' : 'USER_UNBAN',
      targetType: 'user',
      targetId: targetUserId,
      details: { reason },
    });

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('[Admin Ban Error]', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Audit Logs
router.get('/audit-logs', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    res.json({ logs });
  } catch (err) {
    console.error('[Admin Logs Error]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
