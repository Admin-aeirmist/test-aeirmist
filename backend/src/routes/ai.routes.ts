import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { checkEraStatus, askEraAi } from '../lib/eraAi';

const router = Router();

const ChatQuerySchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.string().optional()
});

/**
 * Health and status check for Era AI local daemon
 */
router.get('/status', async (_req, res: Response) => {
  const status = await checkEraStatus();
  res.json({
    success: true,
    engine: 'Era AI (Local)',
    ...status
  });
});

/**
 * Direct chat inference endpoint for web clients & playground
 */
router.post('/chat', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = ChatQuerySchema.parse(req.body);
    const userId = req.user?.userId || 'anonymous';
    const result = await askEraAi(message, `session_${userId}`);

    res.json({
      success: result.success,
      response: result.response,
      latencyMs: result.latencyMs,
      engine: 'Era AI'
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || 'Invalid chat request'
    });
  }
});

/**
 * Business Automation: Auto-Responder rule evaluator
 */
router.post('/business/auto-reply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, rules } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Match keyword rules first
    if (Array.isArray(rules)) {
      const lower = message.toLowerCase();
      for (const rule of rules) {
        if (rule.enabled && rule.keyword && lower.includes(rule.keyword.toLowerCase())) {
          return res.json({
            handled: true,
            ruleMatched: rule.name || rule.keyword,
            reply: rule.replyTemplate
          });
        }
      }
    }

    // Fallback: Era AI Generative responder
    const aiResult = await askEraAi(`As a helpful business assistant for this Aeirmist creator page, answer this customer politely and concisely: "${message}"`);
    res.json({
      handled: true,
      ruleMatched: 'Era AI Generative Assistant',
      reply: aiResult.response
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate auto-reply' });
  }
});

export default router;
