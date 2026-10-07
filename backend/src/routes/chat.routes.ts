import { Router, Response } from 'express';
import { z } from 'zod';
import { ChatDAL } from '../dal/chat.dal';
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
  participantId: z.string().uuid(),
});

const GroupChatSchema = z.object({
  title: z.string().min(1).max(100),
  memberIds: z.array(z.string().uuid()),
  avatarKey: z.string().optional(),
});

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
    const convId = await ChatDAL.findOrCreateDirectConversation(req.user!.userId, participantId);
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
    const conv = await ChatDAL.createGroupConversation(req.user!.userId, title, memberIds, avatarKey);
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
    const convId = req.params.id;
    const isMember = await ChatDAL.isParticipant(convId, req.user!.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const beforeDate = req.query.before ? new Date(req.query.before as string) : undefined;

    const messages = await ChatDAL.getMessages(convId, limit, beforeDate);
    res.json({ messages });
  } catch (err) {
    console.error('[Get Messages Error]', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send Message
router.post('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = req.params.id;
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

    res.status(201).json({ message });
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
    const convId = req.params.id;
    await ChatDAL.markSeen(convId, req.user!.userId);
    io.to(`conv:${convId}`).emit('seen_update', { conversationId: convId, userId: req.user!.userId });
    res.json({ success: true });
  } catch (err) {
    console.error('[Mark Seen Error]', err);
    res.status(500).json({ error: 'Failed to mark conversation seen' });
  }
});

export default router;
