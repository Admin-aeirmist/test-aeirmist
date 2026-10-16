import { eq, desc, and, sql, ne } from 'drizzle-orm';
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

  static async getUserNotifications(userId: string, limit: number = 50, excludeMessages: boolean = true) {
    const condition = excludeMessages
      ? and(eq(notifications.recipientId, userId), ne(notifications.type, 'message'))
      : eq(notifications.recipientId, userId);

    const rows = await db
      .select({
        id: notifications.id,
        recipientId: notifications.recipientId,
        actorId: notifications.actorId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        actionUrl: notifications.actionUrl,
        metadata: notifications.metadata,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorProfile: {
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        }
      })
      .from(notifications)
      .leftJoin(profiles, eq(notifications.actorId, profiles.userId))
      .where(condition)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows.map(r => {
      const meta = (r.metadata as any) || {};
      const actor = r.actorProfile;
      return {
        id: r.id,
        recipientId: r.recipientId,
        actorId: r.actorId,
        type: r.type,
        title: r.title,
        body: r.body,
        actionUrl: r.actionUrl,
        isRead: r.isRead,
        readAt: r.readAt,
        createdAt: r.createdAt,
        metadata: {
          ...meta,
          senderId: meta.senderId || actor?.userId || r.actorId,
          senderName: meta.senderName || actor?.displayName || actor?.username || r.title || 'Aeirmist User',
          senderUsername: meta.senderUsername || actor?.username || 'user',
          senderPhoto: meta.senderPhoto || (actor?.avatarKey ? (actor.avatarKey.startsWith('http') || actor.avatarKey.startsWith('data:') ? actor.avatarKey : `/media/${actor.avatarKey}`) : null),
          senderVerified: meta.senderVerified ?? actor?.isVerified ?? false,
        }
      };
    });
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

  static async delete(notificationId: string, userId: string) {
    const [removed] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId)))
      .returning();
    return !!removed;
  }

  static async getUnreadCount(userId: string, excludeMessages: boolean = true): Promise<number> {
    const condition = excludeMessages
      ? and(eq(notifications.recipientId, userId), eq(notifications.isRead, false), ne(notifications.type, 'message'))
      : and(eq(notifications.recipientId, userId), eq(notifications.isRead, false));
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(condition);
    return result?.count || 0;
  }
}
