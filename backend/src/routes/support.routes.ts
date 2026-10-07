import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { supportTickets, contentReports, auditLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const TicketSchema = z.object({
  type: z.enum(['bug', 'feature', 'general', 'appreciation']).default('general'),
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
    const ticketRef = `TCK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const [ticket] = await db.insert(supportTickets).values({
      ticketRef,
      userId: req.user!.userId,
      type: data.type,
      area: data.area,
      message: data.message,
      attachmentUrl: data.attachmentUrl,
      status: 'open',
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorId: req.user!.userId,
      action: 'SUPPORT_TICKET_CREATED',
      targetType: 'ticket',
      targetId: ticketRef,
      details: { ticketRef, type: data.type },
    });

    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Support Ticket Error]', err);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// Get My Support Tickets
router.get('/tickets/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, req.user!.userId))
      .orderBy(desc(supportTickets.createdAt));

    res.json({ tickets });
  } catch (err) {
    console.error('[User Tickets Error]', err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Submit User or Content Report
router.post('/reports', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = ReportSchema.parse(req.body);
    const reportRef = `RPT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

    const [report] = await db.insert(contentReports).values({
      reportRef,
      reporterId: req.user!.userId,
      reportedUserId: data.reportedUid,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      description: data.description,
      attachmentUrl: data.attachmentUrl,
      status: 'pending_review',
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorId: req.user!.userId,
      action: 'CONTENT_REPORT_SUBMITTED',
      targetType: data.targetType,
      targetId: data.targetId,
      details: { reportRef, reportedUserId: data.reportedUid, reason: data.reason },
    });

    res.status(201).json({ success: true, report });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Support Report Error]', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;
