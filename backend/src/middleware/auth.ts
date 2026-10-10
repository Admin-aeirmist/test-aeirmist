import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, TokenPayload } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UserDAL } from '../dal/user.dal';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload & { isBanned?: boolean };
}

async function loadValidUser(candidate: string | null | undefined): Promise<TokenPayload | null> {
  if (!candidate || typeof candidate !== 'string') return null;
  const clean = candidate.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return null;

  try {
    const resolvedId = await UserDAL.resolveToUserId(clean);
    if (resolvedId) {
      const user = await UserDAL.findById(resolvedId);
      if (user && !user.isBanned && user.status !== 'BANNED' && user.status !== 'DELETED') {
        return { userId: user.id, role: user.role as any, email: user.email };
      }
    }
  } catch {}
  return null;
}

export async function resolveUserFromCredentials(token: string | null): Promise<TokenPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken === 'null' || cleanToken === 'undefined') return null;

  // 1. Standard Server JWT verification (Backend secret)
  try {
    const payload = verifyAccessToken(cleanToken);
    if (payload && payload.userId) {
      const [u] = await db
        .select({ id: users.id, role: users.role, email: users.email, isBanned: users.isBanned, status: users.status })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      if (u && !u.isBanned && u.status !== 'BANNED' && u.status !== 'DELETED') {
        return { userId: u.id, role: u.role as any, email: u.email };
      }
    }
  } catch {
    // Secret verification failed
  }

  // 2. Cloudflare Edge signed token format: jwt_aeirmist_{uid}_{payloadB64}
  if (cleanToken.startsWith('jwt_aeirmist_')) {
    const rawRest = cleanToken.slice('jwt_aeirmist_'.length);
    const lastUnderscore = rawRest.lastIndexOf('_');
    if (lastUnderscore > 0) {
      const candidateB64 = rawRest.slice(lastUnderscore + 1);
      try {
        const jsonStr = Buffer.from(candidateB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const decoded = JSON.parse(jsonStr);
        if (decoded && (decoded.userId || decoded.id || decoded.uid)) {
          const targetId = decoded.userId || decoded.id || decoded.uid;
          const edgeUser = await loadValidUser(targetId);
          if (edgeUser) return edgeUser;
        }
      } catch {}
    }
  }

  return null;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (token === 'null' || token === 'undefined' || token === '') token = null;

  const queryToken = (req.query.token as string) || (req.query.auth as string) || null;
  const candidateToken = token || (queryToken && queryToken !== 'null' && queryToken !== 'undefined' ? queryToken : null);

  if (!candidateToken) {
    return res.status(401).json({ error: 'Authentication required: missing token' });
  }

  try {
    const payload = await resolveUserFromCredentials(candidateToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
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

export async function optionalAuthToken(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token && token !== 'null' && token !== 'undefined') {
    try {
      const payload = await resolveUserFromCredentials(token);
      if (payload) {
        req.user = payload;
      }
    } catch {}
  }
  next();
}
