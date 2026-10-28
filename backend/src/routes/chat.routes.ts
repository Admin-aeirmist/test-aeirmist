import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { mediaAssets, messages, conversations } from '../db/schema';
import { ChatDAL } from '../dal/chat.dal';
import { UserDAL } from '../dal/user.dal';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { assertMediaOwnership } from '../utils/mediaValidator';
import { io } from '../index';
import { redis } from '../db/redis';
import { ERA_AI_USER_ID, triggerEraAssistantReply } from '../lib/eraAi';

const router = Router();

const SendMessageSchema = z.object({
  type: z.string().default('text'),
  content: z.string().optional(),
  mediaKey: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  duration: z.number().optional(),
  replyToId: z.string().nullish().transform(v => (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined)),
  metadata: z.any().optional(),
  clientMessageId: z.string().optional(),
});

const DirectChatSchema = z.object({
  participantId: z.string().min(1),
});

const GroupChatSchema = z.object({
  title: z.string().min(1).max(100),
  memberIds: z.array(z.string().min(1)),
  avatarKey: z.string().optional(),
});

async function resolveUserId(rawId: string): Promise<string | null> {
  if (!rawId || typeof rawId !== 'string') return null;
  const clean = rawId.trim().toLowerCase();
  if (clean === 'era' || clean === 'era_ai' || clean === 'usr_aeirmist_era_ai_official' || clean === ERA_AI_USER_ID) {
    return ERA_AI_USER_ID;
  }
  return UserDAL.resolveToUserId(rawId);
}

export async function resolveConversationId(rawConvId: string, currentUserId: string): Promise<string> {
  if (!rawConvId || typeof rawConvId !== 'string') {
    throw new Error('Invalid conversation identifier');
  }

  const cleanConvId = rawConvId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanConvId);
  if (isUuid) {
    const exists = await ChatDAL.getConversationById(cleanConvId);
    if (exists) return cleanConvId;
  }

  // Strip trailing Unix millisecond timestamp if present
  const normalizedConvId = cleanConvId.replace(/_\d{10,14}$/, '');

  // Case 1: new_<targetId> (Direct conversation initiation)
  if (normalizedConvId.startsWith('new_')) {
    const rawTarget = normalizedConvId.slice(4).trim();
    const resolvedTargetId = await resolveUserId(rawTarget);
    if (!resolvedTargetId) {
      throw new Error(`Cannot start direct conversation with invalid recipient: ${rawTarget}`);
    }
    return ChatDAL.findOrCreateDirectConversation(currentUserId, resolvedTargetId);
  }

  // Case 2: Exact UUID pair: <uuidA>_<uuidB> or <uuidA>:<uuidB>
  const uuidPairMatch = normalizedConvId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[_:]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuidPairMatch) {
    const [ , idA, idB ] = uuidPairMatch;
    const target = idA === currentUserId ? idB : idA;
    return ChatDAL.findOrCreateDirectConversation(currentUserId, target);
  }

  // Case 3A: profile_A_profile_B format (strictly two distinct profile_ identifiers)
  const profilePairMatch = normalizedConvId.match(/^(profile_[a-zA-Z0-9_-]+)_(profile_[a-zA-Z0-9_-]+)$/);
  if (profilePairMatch) {
    const [ , partA, partB ] = profilePairMatch;
    const userA = await resolveUserId(partA);
    const userB = await resolveUserId(partB);
    if (userA && userB && (userA === currentUserId || userB === currentUserId)) {
      const target = userA === currentUserId ? userB : userA;
      return ChatDAL.findOrCreateDirectConversation(currentUserId, target);
    }
  }

  // Case 3B: Non-profile alphanumeric pair (e.g. uidA_uidB)
  const uidPairMatch = normalizedConvId.match(/^([a-zA-Z0-9_-]{20,40})_([a-zA-Z0-9_-]{20,40})$/);
  if (uidPairMatch) {
    const [ , partA, partB ] = uidPairMatch;
    const userA = await resolveUserId(partA);
    const userB = await resolveUserId(partB);
    if (userA && userB && (userA === currentUserId || userB === currentUserId)) {
      const target = userA === currentUserId ? userB : userA;
      return ChatDAL.findOrCreateDirectConversation(currentUserId, target);
    }
  }

  // Case 3C: Mixed pair (profile_A_uidB or uidA_profile_B)
  const mixedPairMatch1 = normalizedConvId.match(/^(profile_[a-zA-Z0-9_-]+)_([a-zA-Z0-9_-]{20,40})$/);
  const mixedPairMatch2 = normalizedConvId.match(/^([a-zA-Z0-9_-]{20,40})_(profile_[a-zA-Z0-9_-]+)$/);
  const mixedPairMatch = mixedPairMatch1 || mixedPairMatch2;
  if (mixedPairMatch) {
    const [ , partA, partB ] = mixedPairMatch;
    const userA = await resolveUserId(partA);
    const userB = await resolveUserId(partB);
    if (userA && userB && (userA === currentUserId || userB === currentUserId)) {
      const target = userA === currentUserId ? userB : userA;
      return ChatDAL.findOrCreateDirectConversation(currentUserId, target);
    }
  }

  // Case 3D: Generalized split for composite keys
  const profileSplitIdx = normalizedConvId.lastIndexOf('_profile_');
  const splitIdx = profileSplitIdx !== -1 ? profileSplitIdx : normalizedConvId.lastIndexOf('_');
  if (splitIdx > 0 && splitIdx < normalizedConvId.length - 1) {
    const pA = normalizedConvId.slice(0, splitIdx);
    const pB = normalizedConvId.slice(profileSplitIdx !== -1 ? splitIdx + 1 : splitIdx + 1);
    const uA = await resolveUserId(pA);
    const uB = await resolveUserId(pB);
    if (uA && uB && (uA === currentUserId || uB === currentUserId)) {
      const target = uA === currentUserId ? uB : uA;
      return ChatDAL.findOrCreateDirectConversation(currentUserId, target);
    }
  }

  // Case 4: Single target user/profile identifier (e.g. direct conversation opened with target user ID/username)
  const singleTargetId = await resolveUserId(normalizedConvId);
  if (singleTargetId) {
    return ChatDAL.findOrCreateDirectConversation(currentUserId, singleTargetId);
  }

  throw new Error(`Invalid or nonexistent conversation identifier: ${rawConvId}`);
}

// List Conversations
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await ChatDAL.getUserConversations(req.user!.userId);
    res.json({ conversations: list });
  } catch (err) {
    console.error('[Get Conversations Error]', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Direct Chat
router.post('/conversations/direct', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participantId } = DirectChatSchema.parse(req.body);
    const resolvedTargetId = await resolveUserId(participantId);
    if (!resolvedTargetId || resolvedTargetId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot start direct conversation with yourself or invalid recipient' });
    }
    const convId = await ChatDAL.findOrCreateDirectConversation(req.user!.userId, resolvedTargetId);
    res.json({ conversationId: convId });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Direct Chat Error]', err);
    res.status(500).json({ error: 'Failed to start direct conversation' });
  }
});

// Group Chat
router.post('/conversations/group', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, memberIds, avatarKey } = GroupChatSchema.parse(req.body);
    const resolvedMemberIds = (await Promise.all(memberIds.map(resolveUserId))).filter((id: string | null): id is string => Boolean(id));
    const conv = await ChatDAL.createGroupConversation(req.user!.userId, title, resolvedMemberIds, avatarKey);
    res.status(201).json({ conversation: conv });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Group Chat Error]', err);
    res.status(500).json({ error: 'Failed to create group conversation' });
  }
});

// Get Messages
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const beforeDate = req.query.before ? new Date(req.query.before as string) : undefined;

    const messages = await ChatDAL.getMessages(convId, limit, beforeDate);

    // Asynchronously mark messages from other members as delivered and broadcast
    (async () => {
      try {
        const hadUndelivered = await ChatDAL.markDelivered(convId, req.user!.userId);
        if (hadUndelivered) {
          const deliveredPayload = {
            conversationId: convId,
            rawConversationId: req.params.id,
            deliveredToUserId: req.user!.userId,
            deliveredAt: new Date().toISOString()
          };
          io.to(`conv:${convId}`).emit('messages_delivered', deliveredPayload);
          if (req.params.id && req.params.id !== convId) {
            io.to(`conv:${req.params.id}`).emit('messages_delivered', deliveredPayload);
          }
          const members = await ChatDAL.getConversationMembers(convId);
          for (const m of members) {
            io.to(`user:${m.userId}`).emit('messages_delivered', deliveredPayload);
            if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('messages_delivered', deliveredPayload);
            if (m.profileId) io.to(`user:${m.profileId}`).emit('messages_delivered', deliveredPayload);
          }
        }
      } catch (e) {}
    })();

    res.json({ messages, conversationId: convId });
  } catch (err: any) {
    if (err?.message?.includes('Invalid or nonexistent') || err?.message?.includes('Cannot start direct conversation')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[Get Messages Error]', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send Message
router.post('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const data = SendMessageSchema.parse(req.body);

    // Validate mediaKey ownership if mediaKey is provided
    if (data.mediaKey) {
      const isAllowed = await assertMediaOwnership(data.mediaKey, req.user!.userId);
      if (!isAllowed) {
        return res.status(403).json({ error: 'Unauthorized or missing media asset' });
      }
    }

    // Validate replyToId message existence and boundary
    if (data.replyToId) {
      const parentMsg = await ChatDAL.getMessageById(data.replyToId);
      if (!parentMsg) {
        return res.status(400).json({ error: 'Referenced reply message does not exist' });
      }
      if (parentMsg.conversationId !== convId) {
        return res.status(400).json({ error: 'Referenced reply message does not belong to this conversation' });
      }
      if (parentMsg.deletedAt) {
        return res.status(400).json({ error: 'Cannot reply to a deleted message' });
      }
    }

    const message = await ChatDAL.sendMessage({
      conversationId: convId,
      senderId: req.user!.userId,
      type: data.type,
      content: data.content,
      mediaKey: data.mediaKey,
      fileName: data.fileName,
      fileSize: data.fileSize,
      duration: data.duration,
      replyToId: data.replyToId,
      metadata: data.metadata,
      clientMessageId: data.clientMessageId || data.metadata?.clientMessageId || data.metadata?.optimisticId,
    });

    redis.set(`last_seen:${req.user!.userId}`, Date.now()).catch(() => {});

    // Real-time broadcast to authorized conversation room and participant user channels in ONE unified atomic emit
    const broadcastPayload = { conversationId: convId, rawConversationId: req.params.id, message };
    let broadcaster = io.to(`conv:${convId}`);
    if (req.params.id && req.params.id !== convId) {
      broadcaster = broadcaster.to(`conv:${req.params.id}`);
    }

    const members = await ChatDAL.getConversationMembers(convId);
    for (const m of members) {
      broadcaster = broadcaster.to(`user:${m.userId}`);
      if (m.firebaseUid) broadcaster = broadcaster.to(`user:${m.firebaseUid}`);
      if (m.profileId) broadcaster = broadcaster.to(`user:${m.profileId}`);
    }
    broadcaster.emit('new_message', broadcastPayload);

    // Trigger Era AI Assistant if this conversation is with Era AI or mentions @Era
    const isEraParticipant = members.some(m => m.userId === ERA_AI_USER_ID);
    const mentionsEra = data.content && /@era\b/i.test(data.content);
    if ((isEraParticipant || mentionsEra) && data.content && req.user!.userId !== ERA_AI_USER_ID) {
      triggerEraAssistantReply(convId, data.content, req.user!.userId).catch(err => {
        console.error('⚠️ [Era AI Bridge] Failed to execute Era assistant reply:', err);
      });
    }

    // Asynchronously dispatch in-app notifications for message recipients
    (async () => {
      try {
        const senderProfile = await UserDAL.getProfileByUserId(req.user!.userId);
        const senderName = senderProfile?.displayName || senderProfile?.username || 'New message';
        const msgText = data.content ? (data.content.length > 80 ? data.content.slice(0, 77) + '...' : data.content) : (data.type ? `Sent a ${data.type}` : 'Sent you a message');
        for (const m of members) {
          if (m.userId !== req.user!.userId) {
            // Skip notification for recipients who have muted this conversation
            if (m.isMuted) continue;
            const notif = await NotificationDAL.create({
              recipientId: m.userId,
              actorId: req.user!.userId,
              type: 'message',
              title: senderName,
              body: msgText,
              actionUrl: `/messages?chatId=${convId}`,
              metadata: {
                conversationId: convId,
                senderId: req.user!.userId,
                senderName,
                senderUsername: senderProfile?.username,
                senderPhoto: (senderProfile as any)?.avatarKey 
                  ? ((senderProfile as any).avatarKey.startsWith('data:') || (senderProfile as any).avatarKey.startsWith('http') 
                      ? (senderProfile as any).avatarKey 
                      : `/media/${(senderProfile as any).avatarKey}`) 
                  : null,
              },
            });
            io.to(`user:${m.userId}`).emit('new_notification', { notification: notif });
            if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('new_notification', { notification: notif });
            if (m.profileId) io.to(`user:${m.profileId}`).emit('new_notification', { notification: notif });
          }
        }
      } catch (notifErr) {
        console.warn('[Notification Dispatch Warning]', notifErr);
      }
    })();

    res.status(201).json({ message, conversationId: convId });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    if (err?.message?.includes('Invalid or nonexistent') || err?.message?.includes('Cannot start direct conversation')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[Send Message Error]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark Seen
router.post('/conversations/:id/seen', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    await ChatDAL.markSeen(convId, req.user!.userId);
    redis.set(`last_seen:${req.user!.userId}`, Date.now()).catch(() => {});

    const seenMembers = await ChatDAL.getConversationMembers(convId);
    const me = seenMembers.find((m) => m.userId === req.user!.userId);
    const seenPayload = {
      conversationId: convId,
      rawConversationId: req.params.id,
      userId: req.user!.userId,
      readerUid: me?.firebaseUid,
      readerProfileId: me?.profileId,
      seenAt: new Date().toISOString()
    };

    io.to(`conv:${convId}`).emit('seen_update', seenPayload);
    if (req.params.id && req.params.id !== convId) {
      io.to(`conv:${req.params.id}`).emit('seen_update', seenPayload);
    }

    const deliveredPayload = {
      conversationId: convId,
      rawConversationId: req.params.id,
      deliveredToUserId: req.user!.userId,
      deliveredAt: seenPayload.seenAt
    };
    io.to(`conv:${convId}`).emit('messages_delivered', deliveredPayload);
    if (req.params.id && req.params.id !== convId) {
      io.to(`conv:${req.params.id}`).emit('messages_delivered', deliveredPayload);
    }

    // Broadcast only to conversation members' user channels (NO global broadcast)
    for (const m of seenMembers) {
      io.to(`user:${m.userId}`).emit('seen_update', seenPayload);
      io.to(`user:${m.userId}`).emit('messages_delivered', deliveredPayload);
      if (m.firebaseUid) {
        io.to(`user:${m.firebaseUid}`).emit('seen_update', seenPayload);
        io.to(`user:${m.firebaseUid}`).emit('messages_delivered', deliveredPayload);
      }
      if (m.profileId) {
        io.to(`user:${m.profileId}`).emit('seen_update', seenPayload);
        io.to(`user:${m.profileId}`).emit('messages_delivered', deliveredPayload);
      }
    }

    res.json({ success: true, conversationId: convId });
  } catch (err) {
    console.error('[Mark Seen Error]', err);
    res.status(500).json({ error: 'Failed to mark conversation seen' });
  }
});

// Mark Unread
router.post('/conversations/:id/unread', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    await ChatDAL.markUnread(convId, req.user!.userId);

    const members = await ChatDAL.getConversationMembers(convId);
    const me = members.find((m) => m.userId === req.user!.userId);
    const unreadPayload = {
      conversationId: convId,
      rawConversationId: req.params.id,
      userId: req.user!.userId,
      readerUid: me?.firebaseUid,
      readerProfileId: me?.profileId,
      unread: true,
      unreadCount: 1,
    };

    if (me?.userId) io.to(`user:${me.userId}`).emit('seen_update', unreadPayload);
    if (me?.firebaseUid) io.to(`user:${me.firebaseUid}`).emit('seen_update', unreadPayload);
    if (me?.profileId) io.to(`user:${me.profileId}`).emit('seen_update', unreadPayload);

    res.json({ success: true, conversationId: convId });
  } catch (err) {
    console.error('[Mark Unread Error]', err);
    res.status(500).json({ error: 'Failed to mark conversation as unread' });
  }
});
// Edit Message
router.patch('/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const msg = await ChatDAL.editMessage(req.params.messageId, req.user!.userId, content);
    if (!msg) return res.status(404).json({ error: 'Message not found or unauthorized' });

    const editPayload = { message: msg, conversationId: msg.conversationId };
    io.to(`conv:${msg.conversationId}`).emit('message_edited', editPayload);
    const members = await ChatDAL.getConversationMembers(msg.conversationId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('message_edited', editPayload);
      if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('message_edited', editPayload);
      if (m.profileId) io.to(`user:${m.profileId}`).emit('message_edited', editPayload);
    }
    res.json({ message: msg });
  } catch (err) {
    console.error('[Edit Message Error]', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete Message
router.delete('/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const msg = await ChatDAL.deleteMessage(req.params.messageId, req.user!.userId);
    if (!msg) return res.status(404).json({ error: 'Message not found or unauthorized' });

    const delPayload = { messageId: req.params.messageId, conversationId: msg.conversationId };
    io.to(`conv:${msg.conversationId}`).emit('message_deleted', delPayload);
    const members = await ChatDAL.getConversationMembers(msg.conversationId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('message_deleted', delPayload);
      if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('message_deleted', delPayload);
      if (m.profileId) io.to(`user:${m.profileId}`).emit('message_deleted', delPayload);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Message Error]', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Add Reaction
router.post('/messages/:messageId/reactions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { emoji } = z.object({ emoji: z.string().min(1).max(32) }).parse(req.body);
    const msg = await ChatDAL.getMessageById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const isMember = await ChatDAL.isParticipant(msg.conversationId, req.user!.userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const result = await ChatDAL.addReaction(req.params.messageId, req.user!.userId, emoji);
    const payload = {
      conversationId: msg.conversationId,
      messageId: req.params.messageId,
      reactions: result.reactions,
      userReactions: result.userReactions,
    };

    io.to(`conv:${msg.conversationId}`).emit('message_reaction_updated', payload);
    const members = await ChatDAL.getConversationMembers(msg.conversationId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('message_reaction_updated', payload);
      if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('message_reaction_updated', payload);
      if (m.profileId) io.to(`user:${m.profileId}`).emit('message_reaction_updated', payload);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Add Reaction Error]', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove Reaction
router.delete('/messages/:messageId/reactions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emoji = req.query.emoji ? String(req.query.emoji) : undefined;
    const msg = await ChatDAL.getMessageById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const isMember = await ChatDAL.isParticipant(msg.conversationId, req.user!.userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const result = await ChatDAL.removeReaction(req.params.messageId, req.user!.userId, emoji);
    const payload = {
      conversationId: msg.conversationId,
      messageId: req.params.messageId,
      reactions: result.reactions,
      userReactions: result.userReactions,
    };

    io.to(`conv:${msg.conversationId}`).emit('message_reaction_updated', payload);
    const members = await ChatDAL.getConversationMembers(msg.conversationId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('message_reaction_updated', payload);
      if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('message_reaction_updated', payload);
      if (m.profileId) io.to(`user:${m.profileId}`).emit('message_reaction_updated', payload);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Remove Reaction Error]', err);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Delete Conversation
router.delete('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    await ChatDAL.deleteConversation(convId, req.user!.userId);

    if (io) {
      const delPayload = {
        conversationId: convId,
        rawConversationId: req.params.id,
        userId: req.user!.userId,
      };
      io.to(`user:${req.user!.userId}`).emit('conversation_deleted', delPayload);
      try {
        const user = await UserDAL.findById(req.user!.userId);
        if (user?.firebaseUid) {
          io.to(`user:${user.firebaseUid}`).emit('conversation_deleted', delPayload);
        }
      } catch {}
    }

    res.json({ success: true, conversationId: convId });
  } catch (err: any) {
    console.error('[Delete Conversation Error]', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Clear Conversation Messages
router.post('/conversations/:id/clear', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const clearType = req.body?.clearType || 'me';

    if (clearType === 'both') {
      await db.delete(messages).where(eq(messages.conversationId, convId));
      await db.update(conversations).set({ lastMessagePreview: null, lastMessageAt: null }).where(eq(conversations.id, convId));
      if (io) {
        io.to(`conv:${convId}`).emit('chat_cleared', { conversationId: convId, clearType: 'both' });
      }
    } else {
      await db.delete(messages).where(and(eq(messages.conversationId, convId), eq(messages.senderId, req.user!.userId)));
    }

    res.json({ success: true, conversationId: convId });
  } catch (err: any) {
    console.error('[Clear Conversation Error]', err);
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
});

// Toggle Pin
router.post('/conversations/:id/pin', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });
    const isPinned = await ChatDAL.togglePin(convId, req.user!.userId);
    res.json({ success: true, isPinned, conversationId: convId });
  } catch (err: any) {
    console.error('[Toggle Pin Error]', err);
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

// Toggle Mute
router.post('/conversations/:id/mute', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });
    const isMuted = await ChatDAL.toggleMute(convId, req.user!.userId);
    res.json({ success: true, isMuted, conversationId: convId });
  } catch (err: any) {
    console.error('[Toggle Mute Error]', err);
    res.status(500).json({ error: 'Failed to toggle mute' });
  }
});

// Toggle Archive
router.post('/conversations/:id/archive', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied' });
    const isArchived = await ChatDAL.toggleArchive(convId, req.user!.userId);
    res.json({ success: true, isArchived, conversationId: convId });
  } catch (err: any) {
    console.error('[Toggle Archive Error]', err);
    res.status(500).json({ error: 'Failed to toggle archive' });
  }
});

// Update Conversation Theme Settings
router.patch('/conversations/:id/theme', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const convId = await resolveConversationId(req.params.id, userId);
    const themeSettings = req.body?.themeSettings || {};
    const updated = await ChatDAL.updateConversationThemeSettings(convId, userId, themeSettings);

    if (io) {
      const payload = {
        conversationId: convId,
        themeSettings: updated?.themeSettings || themeSettings
      };
      io.to(`conv:${convId}`).emit('conversation_theme_updated', payload);
      io.to(convId).emit('conversation_theme_updated', payload);
      try {
        const members = await ChatDAL.getConversationMembers(convId);
        for (const m of members) {
          if (m.userId) io.to(`user:${m.userId}`).emit('conversation_theme_updated', payload);
          if (m.firebaseUid) io.to(`user:${m.firebaseUid}`).emit('conversation_theme_updated', payload);
          if (m.profileId) io.to(`user:${m.profileId}`).emit('conversation_theme_updated', payload);
        }
      } catch (memErr) {
        console.error('[Theme Socket Members Broadcast Error]', memErr);
      }
    }

    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    console.error('[Update Conversation Theme Error]', err);
    res.status(500).json({ error: err.message || 'Failed to update conversation theme' });
  }
});

export default router;
