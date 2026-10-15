import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UserDAL } from '../dal/user.dal';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env';
import { redis } from '../db/redis';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload & { isBanned?: boolean };
}

const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'aeirmist-d4dd8';
const firebaseJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface VerifiedFirebasePayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: any;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebasePayload | null> {
  // 1. Google JWKS signature verification (RS256)
  try {
    const { payload } = await jwtVerify(token, firebaseJWKS, {
      issuer: `https://securetoken.google.com/${FB_PROJECT}`,
      audience: FB_PROJECT,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub === 'string' && payload.sub) {
      return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        email_verified: typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
        ...payload,
      };
    }
    return null;
  } catch (err: any) {
    // 2. Development/test helper: allow test Firebase tokens cryptographically signed with backend secret
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testSecret = new TextEncoder().encode(env.JWT_SECRET);
        const { payload } = await jwtVerify(token, testSecret, {
          issuer: `https://securetoken.google.com/${FB_PROJECT}`,
          audience: FB_PROJECT,
          algorithms: ['HS256'],
        });
        if (typeof payload.sub === 'string' && payload.sub && payload.is_test_user) {
          return {
            sub: payload.sub,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            email_verified: typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
            name: typeof payload.name === 'string' ? payload.name : undefined,
            picture: typeof payload.picture === 'string' ? payload.picture : undefined,
            ...payload,
          };
        }
      } catch {}
    }

    console.warn('[Auth] Firebase token verify failed:', err.code || err.message);
    return null;
  }
}

export async function resolveUserFromCredentials(token: string | null): Promise<TokenPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken === 'null' || cleanToken === 'undefined') return null;

  // 1. Standard Server JWT verification (Backend secret HS256)
  try {
    const payload = verifyAccessToken(cleanToken);
    if (payload && payload.userId) {
      const [u] = await db
        .select({ id: users.id, role: users.role, email: users.email, isBanned: users.isBanned, status: users.status })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      if (u) {
        if (u.isBanned || u.status === 'BANNED' || u.status === 'DELETED') {
          console.warn(`[Auth] Native JWT user ${u.id} is banned/deleted (status=${u.status}, isBanned=${u.isBanned}).`);
          return null;
        }
        return { userId: u.id, role: u.role as any, email: u.email };
      } else {
        console.warn(`[Auth] Native JWT valid for userId=${payload.userId}, but no matching row in Postgres.`);
      }
    }
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      console.warn(`[Auth Debug] Native JWT expired at: ${err.expiredAt}`);
    } else {
      // Secret mismatch or non-native format - proceed to Firebase fallback
    }
  }

  // 2. Firebase ID token (Cryptographically verified against Google JWKS RS256)
  try {
    const fbPayload = await verifyFirebaseIdToken(cleanToken);
    if (fbPayload && fbPayload.sub) {
      if (String(fbPayload.email || '').toLowerCase() === 'gateway_node@aeirmist.social') {
        console.warn('[Auth Failure] Shared gateway Firebase account rejected as an API identity (client must use its own session token).');
        return null;
      }

      // Check if this identity was purged by an admin
      try {
        const isPurgedUid = await redis.sismember('purged_firebase_uids', fbPayload.sub);
        const isPurgedEmail = fbPayload.email ? await redis.sismember('purged_emails', fbPayload.email.toLowerCase()) : false;
        if (isPurgedUid || isPurgedEmail) {
          console.warn(`[Auth Security] Denied request from permanently purged account (uid=${fbPayload.sub}, email=${fbPayload.email || 'none'}).`);
          return null;
        }
      } catch {}

      let u = await UserDAL.findByFirebaseUid(fbPayload.sub);
      if (!u && fbPayload.email) {
        // Fallback: check if existing user with matching email
        u = await UserDAL.findByEmail(fbPayload.email);
        if (u) {
          await db.update(users).set({ firebaseUid: fbPayload.sub }).where(eq(users.id, u.id));
        }
      }

      if (!u) {
        // STRICT SECURITY: Never silently auto-provision deleted/unknown accounts inside general auth middleware!
        // Registration/Provisioning must only occur via explicit sign-up/login flows.
        console.warn(`[Auth Failure] Verified Firebase token for uid=${fbPayload.sub}, but account has NO row in Postgres. Rejecting.`);
        return null;
      }

      if (u) {
        if (u.isBanned || u.status === 'BANNED' || u.status === 'DELETED') {
          console.warn(`[Auth] User id=${u.id} (Firebase uid=${fbPayload.sub}) is BANNED or DELETED (status=${u.status}, isBanned=${u.isBanned}). Denying authentication.`);
          return null;
        }
        return { userId: u.id, role: u.role as any, email: u.email };
      }
    } else {
      console.warn(`[Auth] Token could not be verified by either Native JWT or Firebase JWKS.`);
    }
  } catch (err: any) {
    console.warn('[Auth Debug] Firebase token verification error:', err.message);
  }

  return null;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (token === 'null' || token === 'undefined' || token === '') token = null;

  // Only permit ?token= or ?auth= query param for Socket.IO transport requests to prevent URL/log leaking
  const isSocketPath = req.originalUrl?.includes('/socket.io') || req.path?.includes('/socket.io');
  const queryToken = isSocketPath ? ((req.query.token as string) || (req.query.auth as string) || null) : null;
  const cookieToken = (req as any).cookies?.token || (req as any).cookies?.auth_token || null;
  const candidateToken = token || (queryToken && queryToken !== 'null' && queryToken !== 'undefined' ? queryToken : null) || cookieToken;

  if (!candidateToken) {
    console.warn(`[Auth Failure] 401 Unauthorized: Missing Authorization header or token. (Method: ${req.method}, Path: ${req.originalUrl}, IP: ${req.ip})`);
    return res.status(401).json({ error: 'Authentication required: missing token', code: 'MISSING_TOKEN' });
  }

  try {
    const payload = await resolveUserFromCredentials(candidateToken);
    if (!payload) {
      console.warn(`[Auth Failure] 401 Unauthorized: Invalid, expired, or unresolvable token. (Method: ${req.method}, Path: ${req.originalUrl}, Token Prefix: ${candidateToken.substring(0, 15)}...)`);
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    req.user = payload;
    next();
  } catch (err: any) {
    console.warn(`[Auth Failure] 401 Unauthorized: Exception during auth verification (${err?.message}). (Path: ${req.originalUrl})`);
    return res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_EXCEPTION' });
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
