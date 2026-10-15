import { eq, and, or, desc, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '../db';
import { redis } from '../db/redis';
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
    if (!conversationId || typeof conversationId !== 'string') return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return false;
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
          lastReadAt: conversationMembers.lastReadAt,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
          firebaseUid: users.firebaseUid,
          profileId: profiles.id,
          updatedAt: profiles.updatedAt,
        })
        .from(conversationMembers)
        .innerJoin(users, eq(conversationMembers.userId, users.id))
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(conversationMembers.conversationId, row.conversation.id));

      const otherParticipant = participants.find((p) => p.userId !== userId) || null;
      let isOtherOnline = false;
      if (otherParticipant) {
        try {
          const isOnline = (await redis.sismember('online_users', otherParticipant.userId)) ||
                           (otherParticipant.firebaseUid ? await redis.sismember('online_users', otherParticipant.firebaseUid) : 0) ||
                           (otherParticipant.profileId ? await redis.sismember('online_users', otherParticipant.profileId) : 0);
          isOtherOnline = Boolean(isOnline);
          (otherParticipant as any).isOnline = isOtherOnline;
          const lastSeenStr = await redis.get(`last_seen:${otherParticipant.userId}`);
          (otherParticipant as any).lastSeen = isOtherOnline ? Date.now() : (lastSeenStr ? Number(lastSeenStr) : null);
        } catch {}
      }

      // lastRead map (epoch ms) keyed by every identifier the client may use.
      // Drives persistent "Seen" state and accurate unread detection after reload.
      const lastRead: Record<string, number> = {};
      for (const p of participants) {
        if (!p.lastReadAt) continue;
        const ms = new Date(p.lastReadAt).getTime();
        for (const key of [p.userId, p.firebaseUid, p.profileId]) {
          if (key) lastRead[key] = ms;
        }
      }

      result.push({
        ...row.conversation,
        unreadCount: row.member.unreadCount,
        unread: (row.member.unreadCount ?? 0) > 0,
        isMuted: row.member.isMuted,
        isPinned: row.member.isPinned,
        participants,
        otherParticipant,
        otherParticipantId: otherParticipant?.profileId || otherParticipant?.userId || otherParticipant?.firebaseUid || null,
        otherParticipantUid: otherParticipant?.firebaseUid || null,
        otherProfile: otherParticipant,
        online: isOtherOnline,
        lastRead,
      });
    }

    return result;
  }

  static async getMessages(conversationId: string, limit: number = 50, beforeDate?: Date) {
    if (!conversationId || typeof conversationId !== 'string') return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return [];

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

    const msgIds = rows.map((r) => r.message.id);
    const reactionsMap = new Map<string, Record<string, number>>();
    const userReactionsMap = new Map<string, Record<string, string>>();

    if (msgIds.length > 0) {
      try {
        const rxRows = await db
          .select({
            messageId: messageReactions.messageId,
            emoji: messageReactions.emoji,
            userId: messageReactions.userId,
            firebaseUid: users.firebaseUid,
            profileId: profiles.id,
          })
          .from(messageReactions)
          .innerJoin(users, eq(messageReactions.userId, users.id))
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(inArray(messageReactions.messageId, msgIds));

        const countedUserReactionsByMsg = new Set<string>();
        for (const rx of rxRows) {
          if (!reactionsMap.has(rx.messageId)) reactionsMap.set(rx.messageId, {});
          if (!userReactionsMap.has(rx.messageId)) userReactionsMap.set(rx.messageId, {});

          const rxUserKey = `${rx.messageId}_${rx.userId}_${rx.emoji}`;
          if (!countedUserReactionsByMsg.has(rxUserKey)) {
            countedUserReactionsByMsg.add(rxUserKey);
            const rObj = reactionsMap.get(rx.messageId)!;
            rObj[rx.emoji] = (rObj[rx.emoji] || 0) + 1;
          }

          const uObj = userReactionsMap.get(rx.messageId)!;
          if (rx.userId) uObj[rx.userId] = rx.emoji;
          if (rx.firebaseUid) uObj[rx.firebaseUid] = rx.emoji;
          if (rx.profileId) uObj[rx.profileId] = rx.emoji;
        }
      } catch (e) {
        console.warn('[ChatDAL] Failed to load message reactions:', e);
      }
    }

    return rows.reverse().map((r) => ({
      ...r.message,
      sender: r.sender,
      senderId: r.message.senderId, // Canonical PostgreSQL users.id UUID
      senderUid: r.sender?.firebaseUid || r.message.senderId,
      senderProfileId: r.sender?.profileId,
      senderDbId: r.sender?.id || r.message.senderId,
      reactions: reactionsMap.get(r.message.id) || {},
      userReactions: userReactionsMap.get(r.message.id) || {},
    }));
  }

  private static inFlightSends = new Map<string, Promise<any>>();

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
    clientMessageId?: string;
  }) {
    const optId = data.metadata?.optimisticId || data.metadata?.clientMessageId || data.clientMessageId;
    if (optId && typeof optId === 'string') {
      const lockKey = `${data.conversationId}:${data.senderId}:${optId}`;
      const inFlight = this.inFlightSends.get(lockKey);
      if (inFlight) {
        return inFlight;
      }

      const executionPromise = (async () => {
        try {
          return await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
            const existing = await tx
              .select()
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, data.conversationId),
                  eq(messages.senderId, data.senderId),
                  sql`(${messages.metadata}->>'optimisticId' = ${optId} OR ${messages.metadata}->>'clientMessageId' = ${optId})`
                )
              )
              .limit(1);

            if (existing.length > 0) {
              const msg = existing[0];
              const [senderUser] = await tx
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
                senderId: data.senderId,
                senderUid: senderUser?.firebaseUid || data.senderId,
                senderProfileId: senderUser?.profileId,
                senderDbId: senderUser?.id || data.senderId,
              };
            }

            return await this.executeSendMessageInsert(data, optId, tx);
          });
        } finally {
          this.inFlightSends.delete(lockKey);
        }
      })();

      this.inFlightSends.set(lockKey, executionPromise);
      return executionPromise;
    }

    return this.executeSendMessageInsert(data, undefined, db);
  }

  private static async executeSendMessageInsert(data: {
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
    clientMessageId?: string;
  }, optId?: string, executor: any = db) {
    const mergedMetadata = {
      ...(data.metadata || {}),
      ...(optId ? { optimisticId: optId, clientMessageId: optId } : {})
    };

    let isDelivered = false;
    try {
      const otherMembers = await executor
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, data.conversationId),
            sql`${conversationMembers.userId} != ${data.senderId}`
          )
        );
      for (const m of otherMembers) {
        const isOnline = await redis.sismember('online_users', m.userId);
        if (isOnline) {
          isDelivered = true;
          break;
        }
      }
    } catch {}

    const [msg] = await executor
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
        metadata: mergedMetadata,
        isDelivered,
      })
      .returning();

    // Update conversation preview and timestamp
    await executor
      .update(conversations)
      .set({
        lastMessagePreview: data.content || (data.type ? `[${data.type}]` : ''),
        lastMessageAt: msg.createdAt,
        updatedAt: msg.createdAt,
      })
      .where(eq(conversations.id, data.conversationId));

    // Increment unread count for other members
    await executor
      .update(conversationMembers)
      .set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
      .where(
        and(
          eq(conversationMembers.conversationId, data.conversationId),
          sql`${conversationMembers.userId} != ${data.senderId}`
        )
      );

    const [senderUser] = await executor
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

  static async markDelivered(conversationId: string, recipientUserId: string): Promise<boolean> {
    const updated = await db
      .update(messages)
      .set({ isDelivered: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${recipientUserId}`,
          eq(messages.isDelivered, false)
        )
      )
      .returning({ id: messages.id });
    return updated.length > 0;
  }

  static async markSeen(conversationId: string, userId: string) {
    if (!conversationId || typeof conversationId !== 'string') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return;

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
      .set({ isSeen: true, isDelivered: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`,
          or(eq(messages.isSeen, false), eq(messages.isDelivered, false))
        )
      );
  }

  static async markUnread(conversationId: string, userId: string) {
    if (!conversationId || typeof conversationId !== 'string') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return;

    await db
      .update(conversationMembers)
      .set({ unreadCount: sql`GREATEST(${conversationMembers.unreadCount}, 1)` })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId)
        )
      );
  }

  static async getConversationMembers(conversationId: string) {
    if (!conversationId || typeof conversationId !== 'string') return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return [];

    return db
      .select({
        userId: conversationMembers.userId,
        firebaseUid: users.firebaseUid,
        profileId: profiles.id,
        isMuted: conversationMembers.isMuted,
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
    const existing = await this.getMessageById(messageId);
    if (!existing || existing.senderId !== userId) return null;
    const existingMeta = (typeof existing.metadata === 'object' && existing.metadata !== null) ? existing.metadata : {};
    const updatedMeta = { ...existingMeta, edited: true, editedAt: new Date().toISOString() };
    const [msg] = await db
      .update(messages)
      .set({ 
        content: newContent, 
        updatedAt: new Date(),
        metadata: updatedMeta
      })
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

  static async deleteConversation(conversationId: string, userId: string) {
    if (!conversationId || typeof conversationId !== 'string') return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return false;
    await db
      .delete(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));

    // Clean up conversation if no remaining members exist
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));

    if (!remaining || remaining.count === 0) {
      await db.delete(conversations).where(eq(conversations.id, conversationId));
    }
    return true;
  }

  static async togglePin(conversationId: string, userId: string): Promise<boolean> {
    if (!conversationId || typeof conversationId !== 'string') return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return false;
    const [member] = await db
      .select({ isPinned: conversationMembers.isPinned })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    const nextVal = !member?.isPinned;
    await db
      .update(conversationMembers)
      .set({ isPinned: nextVal })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    return nextVal;
  }

  static async toggleMute(conversationId: string, userId: string): Promise<boolean> {
    if (!conversationId || typeof conversationId !== 'string') return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return false;
    const [member] = await db
      .select({ isMuted: conversationMembers.isMuted })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    const nextVal = !member?.isMuted;
    await db
      .update(conversationMembers)
      .set({ isMuted: nextVal })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    return nextVal;
  }

  static async toggleArchive(conversationId: string, userId: string): Promise<boolean> {
    if (!conversationId || typeof conversationId !== 'string') return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
    if (!isUuid) return false;
    const [member] = await db
      .select({ isArchived: conversationMembers.isArchived })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    const nextVal = !member?.isArchived;
    await db
      .update(conversationMembers)
      .set({ isArchived: nextVal })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    return nextVal;
  }

  static async getMessageReactions(messageId: string) {
    if (!messageId || typeof messageId !== 'string') return { reactions: {}, userReactions: {} };
    const rows = await db
      .select({
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        firebaseUid: users.firebaseUid,
        profileId: profiles.id,
      })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(messageReactions.messageId, messageId));

    const reactions: Record<string, number> = {};
    const userReactions: Record<string, string> = {};
    const countedUserReactions = new Set<string>();
    for (const r of rows) {
      const userEmojiKey = `${r.userId}_${r.emoji}`;
      if (!countedUserReactions.has(userEmojiKey)) {
        countedUserReactions.add(userEmojiKey);
        reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
      }
      if (r.userId) userReactions[r.userId] = r.emoji;
      if (r.firebaseUid) userReactions[r.firebaseUid] = r.emoji;
      if (r.profileId) userReactions[r.profileId] = r.emoji;
    }
    return { reactions, userReactions };
  }

  static async addReaction(messageId: string, userId: string, emoji: string) {
    if (!messageId || !userId || !emoji) return { reactions: {}, userReactions: {} };
    // Remove any previous reaction from this user on this message
    await db.delete(messageReactions).where(
      and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId))
    );
    await db.insert(messageReactions).values({
      messageId,
      userId,
      emoji,
    });
    return this.getMessageReactions(messageId);
  }

  static async removeReaction(messageId: string, userId: string, emoji?: string) {
    if (!messageId || !userId) return { reactions: {}, userReactions: {} };
    const conditions = [
      eq(messageReactions.messageId, messageId),
      eq(messageReactions.userId, userId),
    ];
    if (emoji) conditions.push(eq(messageReactions.emoji, emoji));
    await db.delete(messageReactions).where(and(...conditions));
    return this.getMessageReactions(messageId);
  }

  static async updateConversationThemeSettings(conversationId: string, userId: string, themeSettings: any) {
    const isMember = await this.isParticipant(conversationId, userId);
    if (!isMember) {
      throw new Error('Unauthorized to update conversation theme');
    }
    const [updated] = await db
      .update(conversations)
      .set({
        themeSettings: themeSettings || {},
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    return updated;
  }
}
