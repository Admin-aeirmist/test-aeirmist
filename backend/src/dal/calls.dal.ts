import { eq, or, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { calls, users, profiles } from '../db/schema';

export class CallsDAL {
  static async logCall(data: {
    callerId: string;
    receiverId: string;
    type: string;
    status: string;
    duration?: number;
  }) {
    const [call] = await db
      .insert(calls)
      .values({
        callerId: data.callerId,
        receiverId: data.receiverId,
        type: data.type,
        status: data.status,
        duration: data.duration || 0,
        endedAt: data.status === 'ended' ? new Date() : null,
      })
      .returning();

    return call;
  }

  static async updateCallStatus(callId: string, status: string, duration?: number) {
    const [updated] = await db
      .update(calls)
      .set({
        status,
        duration: duration !== undefined ? duration : undefined,
        endedAt: ['ended', 'rejected', 'missed', 'busy'].includes(status) ? new Date() : undefined,
      })
      .where(eq(calls.id, callId))
      .returning();

    return updated;
  }

  static async getCallHistory(userId: string, limit: number = 50) {
    // Fetch calls where user is caller or receiver
    const rows = await db
      .select({
        id: calls.id,
        callerId: calls.callerId,
        receiverId: calls.receiverId,
        type: calls.type,
        status: calls.status,
        duration: calls.duration,
        createdAt: calls.createdAt,
        endedAt: calls.endedAt,
      })
      .from(calls)
      .where(or(eq(calls.callerId, userId), eq(calls.receiverId, userId)))
      .orderBy(desc(calls.createdAt))
      .limit(limit);

    // Enrich with other party profile
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const otherUserId = c.callerId === userId ? c.receiverId : c.callerId;
        const [otherUser] = await db
          .select({
            id: users.id,
            username: profiles.username,
            displayName: profiles.displayName,
            avatarKey: profiles.avatarKey,
          })
          .from(users)
          .innerJoin(profiles, eq(users.id, profiles.userId))
          .where(eq(users.id, otherUserId))
          .limit(1);

        return {
          ...c,
          isOutgoing: c.callerId === userId,
          otherUser: otherUser || { id: otherUserId, username: 'Unknown', displayName: 'Unknown' },
        };
      })
    );

    return enriched;
  }
}
