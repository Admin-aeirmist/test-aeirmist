import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { notifications, profiles } from '../db/schema';

export class NotificationDAL {
  static async create(data: {
    recipientId: string;
    actorId?: string;
    type: string;
    title: string;
    body: string;
    actionUrl?: string;
    metadata?: any;
  }) {
    const [notif] = await db
      .insert(notifications)
      .values({
        recipientId: data.recipientId,
        actorId: data.actorId,
        type: data.type,
        title: data.title,
        body: data.body,
        actionUrl: data.actionUrl,
        metadata: data.metadata || {},
      })
      .returning();
    return notif;
  }

  static async getUserNotifications(userId: string, limit: number = 30) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  static async markAsRead(notificationId: string, userId: string) {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId)))
      .returning();
    return !!updated;
  }

  static async markAllAsRead(userId: string) {
    return db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.recipientId, userId));
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }
}
