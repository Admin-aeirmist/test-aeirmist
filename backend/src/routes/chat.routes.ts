import { Router, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { ChatDAL } from '../dal/chat.dal';
import { UserDAL } from '../dal/user.dal';
import { NotificationDAL } from '../dal/notification.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { io } from '../index';

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
});

const DirectChatSchema = z.object({
  participantId: z.string().min(1),
});

const GroupChatSchema = z.object({
  title: z.string().min(1).max(100),
  memberIds: z.array(z.string().min(1)),
  avatarKey: z.string().optional(),
});

async function resolveUserId(rawId: string): Promise<string> {
  const resolved = await UserDAL.resolveToUserId(rawId);
  return resolved || rawId;
}

async function resolveConversationId(rawConvId: string, currentUserId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawConvId);
  if (isUuid) return rawConvId;

  // Case 1: new_<targetId> (Direct conversation initiation)
  if (rawConvId.startsWith('new_')) {
    const rawTarget = rawConvId.slice(4);
    const resolvedTargetId = await resolveUserId(rawTarget);
    return ChatDAL.findOrCreateDirectConversation(currentUserId, resolvedTargetId);
  }

  // Case 2: Compound conversation keys: e.g. profile_userA_profile_userB, or userA_userB
  let target = rawConvId;
  if (rawConvId.includes('_profile_')) {
    const splitIdx = rawConvId.indexOf('_profile_');
    const partA = rawConvId.slice(0, splitIdx);
    const partB = rawConvId.slice(splitIdx + 1);
    const [resA, resB] = await Promise.all([resolveUserId(partA), resolveUserId(partB)]);
    if (resA === currentUserId && resB === currentUserId) {
      target = currentUserId;
    } else {
      target = (resA !== currentUserId) ? resA : resB;
    }
  } else if (rawConvId.includes('_')) {
    const parts = rawConvId.split('_');
    if (parts.length === 2) {
      const [resA, resB] = await Promise.all([resolveUserId(parts[0]), resolveUserId(parts[1])]);
      if (resA === currentUserId && resB === currentUserId) {
        target = currentUserId;
      } else {
        target = (resA !== currentUserId) ? resA : resB;
      }
    }
  }

  const resolvedTargetId = await resolveUserId(target);
  return ChatDAL.findOrCreateDirectConversation(currentUserId, resolvedTargetId);
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
    const resolvedMemberIds = await Promise.all(memberIds.map(resolveUserId));
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
    res.json({ messages, conversationId: convId });
  } catch (err) {
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
      const [asset] = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.key, data.mediaKey))
        .limit(1);

      if (asset && asset.ownerId && asset.ownerId !== req.user!.userId) {
        return res.status(403).json({ error: 'Unauthorized: Media asset belongs to another user' });
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
    });

    // Real-time broadcast to room via WebSockets
    const broadcastPayload = { conversationId: convId, rawConversationId: req.params.id, message };
    io.to(`conv:${convId}`).emit('new_message', broadcastPayload);
    if (req.params.id && req.params.id !== convId) {
      io.to(`conv:${req.params.id}`).emit('new_message', broadcastPayload);
    }

    // Also push to participant user rooms so inboxes and open chats update in real time
    const members = await ChatDAL.getConversationMembers(convId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('new_message', broadcastPayload);
      io.to(`user:profile_${m.userId}`).emit('new_message', broadcastPayload);
    }
    // Universal broadcast with conversationId matching in client
    io.emit('new_message', broadcastPayload);

    // Asynchronously dispatch in-app notifications for message recipients
    (async () => {
      try {
        const senderProfile = await UserDAL.getProfileByUserId(req.user!.userId);
        const senderName = senderProfile?.displayName || senderProfile?.username || 'New message';
        const msgText = data.content ? (data.content.length > 80 ? data.content.slice(0, 77) + '...' : data.content) : (data.type ? `Sent a ${data.type}` : 'Sent you a message');
        for (const m of members) {
          if (m.userId !== req.user!.userId) {
            const notif = await NotificationDAL.create({
              recipientId: m.userId,
              actorId: req.user!.userId,
              type: 'message',
              title: senderName,
              body: msgText,
              actionUrl: `/messages?chatId=${convId}`,
              metadata: { conversationId: convId, senderId: req.user!.userId },
            });
            io.to(`user:${m.userId}`).emit('new_notification', { notification: notif });
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
    console.error('[Send Message Error]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark Seen
router.post('/conversations/:id/seen', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = await resolveConversationId(req.params.id, req.user!.userId);
    await ChatDAL.markSeen(convId, req.user!.userId);

    const seenPayload = {
      conversationId: convId,
      rawConversationId: req.params.id,
      userId: req.user!.userId,
      seenAt: new Date().toISOString()
    };

    io.to(`conv:${convId}`).emit('seen_update', seenPayload);
    if (req.params.id && req.params.id !== convId) {
      io.to(`conv:${req.params.id}`).emit('seen_update', seenPayload);
    }

    // Broadcast to all conversation members' user channels
    const members = await ChatDAL.getConversationMembers(convId);
    for (const m of members) {
      io.to(`user:${m.userId}`).emit('seen_update', seenPayload);
    }
    io.emit('seen_update', seenPayload);

    res.json({ success: true, conversationId: convId });
  } catch (err) {
    console.error('[Mark Seen Error]', err);
    res.status(500).json({ error: 'Failed to mark conversation seen' });
  }
});
// Edit Message
router.patch('/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const msg = await ChatDAL.editMessage(req.params.messageId, req.user!.userId, content);
    if (!msg) return res.status(404).json({ error: 'Message not found or unauthorized' });
    io.to(`conv:${msg.conversationId}`).emit('message_edited', { message: msg });
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
    io.to(`conv:${msg.conversationId}`).emit('message_deleted', { messageId: req.params.messageId, conversationId: msg.conversationId });
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete Message Error]', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
