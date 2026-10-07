import { eq, and, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  conversations,
  conversationMembers,
  messages,
  messageReactions,
  profiles,
  users,
} from '../db/schema';

export class ChatDAL {
  static async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
      .limit(1);
    return !!member;
  }

  static async findOrCreateDirectConversation(userA: string, userB: string) {
    if (userA === userB) throw new Error('Cannot start conversation with yourself');

    const firstUser = userA < userB ? userA : userB;
    const secondUser = userA < userB ? userB : userA;
    const lockKey = `direct_chat_${firstUser}_${secondUser}`;

    return await db.transaction(async (tx) => {
      // 1. Acquire transactional advisory lock for the sorted user pair to serialize concurrent creation
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      // 2. Query inside transaction while lock is held
      const common = await tx.execute(sql`
        SELECT cm1.conversation_id 
        FROM conversation_members cm1
        JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
        JOIN conversations c ON c.id = cm1.conversation_id
        WHERE cm1.user_id = ${userA} 
          AND cm2.user_id = ${userB} 
          AND c.type = 'direct'
        LIMIT 1
      `);

      if (common.rows && common.rows.length > 0) {
        return (common.rows[0] as any).conversation_id as string;
      }

      // 3. Create new direct conversation inside the locked transaction
      const [conv] = await tx
        .insert(conversations)
        .values({
          type: 'direct',
        })
        .returning();

      await tx.insert(conversationMembers).values([
        { conversationId: conv.id, userId: userA, role: 'member' },
        { conversationId: conv.id, userId: userB, role: 'member' },
      ]);

      return conv.id;
    });
  }

  static async createGroupConversation(creatorId: string, title: string, memberIds: string[], avatarKey?: string) {
    const [conv] = await db
      .insert(conversations)
      .values({
        type: 'group',
        title,
        avatarKey,
      })
      .returning();

    const uniqueMembers = Array.from(new Set([creatorId, ...memberIds]));
    const memberRows = uniqueMembers.map((uid) => ({
      conversationId: conv.id,
      userId: uid,
      role: uid === creatorId ? 'owner' : 'member',
    }));

    await db.insert(conversationMembers).values(memberRows);

    return conv;
  }

  static async getUserConversations(userId: string) {
    const memberRows = await db
      .select({
        conversation: conversations,
        member: conversationMembers,
      })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
      .where(eq(conversationMembers.userId, userId))
      .orderBy(desc(conversations.updatedAt));

    const result = [];
    for (const row of memberRows) {
      // Fetch all participants for this conversation
      const participants = await db
        .select({
          userId: conversationMembers.userId,
          role: conversationMembers.role,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        })
        .from(conversationMembers)
        .innerJoin(profiles, eq(conversationMembers.userId, profiles.userId))
        .where(eq(conversationMembers.conversationId, row.conversation.id));

      result.push({
        ...row.conversation,
        unreadCount: row.member.unreadCount,
        isMuted: row.member.isMuted,
        isPinned: row.member.isPinned,
        participants,
      });
    }

    return result;
  }

  static async getMessages(conversationId: string, limit: number = 50, beforeDate?: Date) {
    const conditions = [
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
    ];

    if (beforeDate) {
      conditions.push(sql`${messages.createdAt} < ${beforeDate}`);
    }

    const rows = await db
      .select({
        message: messages,
        sender: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse().map((r) => ({
      ...r.message,
      sender: r.sender,
    }));
  }

  static async sendMessage(data: {
    conversationId: string;
    senderId: string;
    type?: string;
    content?: string;
    mediaKey?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    replyToId?: string;
    metadata?: any;
  }) {
    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type || 'text',
        content: data.content,
        mediaKey: data.mediaKey,
        fileName: data.fileName,
        fileSize: data.fileSize,
        duration: data.duration,
        replyToId: data.replyToId,
        metadata: data.metadata || {},
      })
      .returning();

    // Update conversation preview and timestamp
    await db
      .update(conversations)
      .set({
        lastMessagePreview: data.content || (data.type ? `[${data.type}]` : ''),
        lastMessageAt: msg.createdAt,
        updatedAt: msg.createdAt,
      })
      .where(eq(conversations.id, data.conversationId));

    // Increment unread count for other members
    await db
      .update(conversationMembers)
      .set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
      .where(
        and(
          eq(conversationMembers.conversationId, data.conversationId),
          sql`${conversationMembers.userId} != ${data.senderId}`
        )
      );

    return msg;
  }

  static async markSeen(conversationId: string, userId: string) {
    await db
      .update(conversationMembers)
      .set({ unreadCount: 0, lastReadAt: new Date() })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId)
        )
      );

    await db
      .update(messages)
      .set({ isSeen: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`,
          eq(messages.isSeen, false)
        )
      );
  }

  static async getConversationMembers(conversationId: string) {
    return db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
  }

  static async deleteMessage(messageId: string, userId: string) {
    const [msg] = await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(and(eq(messages.id, messageId), eq(messages.senderId, userId)))
      .returning();
    return msg;
  }

  static async editMessage(messageId: string, userId: string, newContent: string) {
    const [msg] = await db
      .update(messages)
      .set({ content: newContent, updatedAt: new Date() })
      .where(and(eq(messages.id, messageId), eq(messages.senderId, userId)))
      .returning();
    return msg;
  }

  static async getMessageById(messageId: string) {
    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    return msg || null;
  }
}
