import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload & { isBanned?: boolean };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required: missing token' });
  }

  try {
    const payload = verifyAccessToken(token);

    // Verify user is not banned
    const [user] = await db
      .select({ isBanned: users.isBanned, status: users.status })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || user.isBanned || user.status === 'BANNED' || user.status === 'DELETED') {
      return res.status(403).json({ error: 'Account is banned or deactivated' });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.includes(req.user.role) || req.user.role === 'super_admin' || req.user.role === 'owner') {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  };
}

export const requireAdmin = requireRole('admin', 'super_admin', 'owner');
export const requireModerator = requireRole('moderator', 'admin', 'super_admin', 'owner');
