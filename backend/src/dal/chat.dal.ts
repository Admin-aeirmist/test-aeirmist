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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userA) || !uuidRegex.test(userB)) {
      throw new Error(`Invalid user IDs for direct conversation: ${userA}, ${userB}`);
    }

    if (userA === userB) {
      return await db.transaction(async (tx) => {
        const selfConv = await tx.execute(sql`
          SELECT cm.conversation_id 
          FROM conversation_members cm
          JOIN conversations c ON c.id = cm.conversation_id
          WHERE cm.user_id = ${userA} AND c.type = 'self'
          LIMIT 1
        `);
        if (selfConv.rows && selfConv.rows.length > 0) {
          return (selfConv.rows[0] as any).conversation_id as string;
        }
        const [conv] = await tx
          .insert(conversations)
          .values({
            type: 'self',
          })
          .returning();
        await tx.insert(conversationMembers).values([
          { conversationId: conv.id, userId: userA, role: 'owner' },
        ]);
        return conv.id;
      });
    }

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
      // Fetch all participants for this conversation with user and profile data
      const participants = await db
        .select({
          userId: conversationMembers.userId,
          role: conversationMembers.role,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
          firebaseUid: users.firebaseUid,
          profileId: profiles.id,
        })
        .from(conversationMembers)
        .innerJoin(users, eq(conversationMembers.userId, users.id))
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(conversationMembers.conversationId, row.conversation.id));

      const otherParticipant = participants.find((p) => p.userId !== userId) || null;

      result.push({
        ...row.conversation,
        unreadCount: row.member.unreadCount,
        isMuted: row.member.isMuted,
        isPinned: row.member.isPinned,
        participants,
        otherParticipant,
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
          firebaseUid: users.firebaseUid,
          profileId: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse().map((r) => ({
      ...r.message,
      sender: r.sender,
      senderId: r.message.senderId, // Canonical PostgreSQL users.id UUID
      senderUid: r.sender?.firebaseUid || r.message.senderId,
      senderProfileId: r.sender?.profileId,
      senderDbId: r.sender?.id || r.message.senderId,
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

    const [senderUser] = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        profileId: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        isVerified: profiles.isVerified,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(users.id, data.senderId))
      .limit(1);

    return {
      ...msg,
      sender: senderUser || null,
      senderId: data.senderId, // Canonical PostgreSQL users.id UUID
      senderUid: senderUser?.firebaseUid || data.senderId,
      senderProfileId: senderUser?.profileId,
      senderDbId: senderUser?.id || data.senderId,
    };
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
      .select({
        userId: conversationMembers.userId,
        firebaseUid: users.firebaseUid,
        profileId: profiles.id,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.userId))
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

  static async getConversationById(conversationId: string) {
    if (!conversationId || typeof conversationId !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return null;
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    return conv || null;
  }
}
