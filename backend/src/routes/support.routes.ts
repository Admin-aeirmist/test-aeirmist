import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { auditLogs } from '../db/schema';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const TicketSchema = z.object({
  type: z.enum(['bug', 'feature', 'general', 'appreciation']),
  area: z.string().nullable().optional(),
  message: z.string().min(5).max(5000),
  attachmentUrl: z.string().nullable().optional(),
});

const ReportSchema = z.object({
  reportedUid: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  reason: z.string().min(1),
  description: z.string().max(2000).optional(),
  attachmentUrl: z.string().nullable().optional(),
});

// Submit Support / Feedback Ticket
router.post('/tickets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = TicketSchema.parse(req.body);
    const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const [log] = await db.insert(auditLogs).values({
      actorId: req.user!.userId,
      action: 'SUPPORT_TICKET_CREATED',
      targetType: 'ticket',
      targetId: ticketId,
      details: {
        ticketId,
        type: data.type,
        area: data.area,
        message: data.message,
        attachmentUrl: data.attachmentUrl,
        status: 'open',
      },
    }).returning();

    res.status(201).json({ success: true, ticketId, logId: log?.id });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Support Ticket Error]', err);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Submit User or Content Report
router.post('/reports', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = ReportSchema.parse(req.body);
    const reportRef = `RPT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

    const [log] = await db.insert(auditLogs).values({
      actorId: req.user!.userId,
      action: 'CONTENT_REPORT_SUBMITTED',
      targetType: data.targetType,
      targetId: data.targetId,
      details: {
        reportId: reportRef,
        reportedUid: data.reportedUid,
        reason: data.reason,
        description: data.description,
        attachmentUrl: data.attachmentUrl,
        status: 'pending_review',
      },
    }).returning();

    res.status(201).json({ success: true, reportId: reportRef, logId: log?.id });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Support Report Error]', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;
