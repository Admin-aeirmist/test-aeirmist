import { Router, Response } from 'express';
import { z } from 'zod';
import { ChatDAL } from '../dal/chat.dal';
import { UserDAL } from '../dal/user.dal';
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
  replyToId: z.string().uuid().optional(),
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
  if (isUuid) return rawId;
  const user = await UserDAL.findByEmailOrUsername(rawId) || await UserDAL.findByFirebaseUid(rawId);
  return user?.id || rawId;
}

async function resolveConversationId(rawConvId: string, currentUserId: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawConvId);
  if (isUuid) return rawConvId;

  // Handles new_<targetId> or <userA>_<userB>
  let target = rawConvId.startsWith('new_') ? rawConvId.replace('new_', '') : rawConvId;
  if (target.includes('_')) {
    const parts = target.split('_');
    const resolvedParts = await Promise.all(parts.map(resolveUserId));
    const other = resolvedParts.find((p) => p !== currentUserId);
    target = other || resolvedParts[0];
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
    io.to(`conv:${convId}`).emit('new_message', { conversationId: convId, message });

    // Also push to participant user rooms
    const members = await ChatDAL.getConversationMembers(convId);
    for (const m of members) {
      if (m.userId !== req.user!.userId) {
        io.to(`user:${m.userId}`).emit('new_message', { conversationId: convId, message });
      }
    }

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
    io.to(`conv:${convId}`).emit('seen_update', { conversationId: convId, userId: req.user!.userId });
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
