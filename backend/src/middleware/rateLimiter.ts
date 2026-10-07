import { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
  message?: string;
}

/**
 * High-performance Redis sliding window rate limiter
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowSeconds,
    maxRequests,
    prefix = 'rl',
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown_ip';

      const key = `ratelimit:${prefix}:${clientIp}`;
      const now = Date.now();
      const clearBefore = now - windowSeconds * 1000;

      // Pipeline Redis operations
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, clearBefore);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSeconds + 1);

      const results = await multi.exec();

      if (!results) {
        return next();
      }

      // results[2] is zcard result: [null, count]
      const count = (results[2][1] as number) || 1;
      const remaining = Math.max(0, maxRequests - count);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowSeconds * 1000) / 1000));

      if (count > maxRequests) {
        return res.status(429).json({
          error: message,
          retryAfterSeconds: windowSeconds,
        });
      }

      next();
    } catch (err) {
      // Fail-open on Redis errors to prevent taking down API
      console.warn('[RateLimiter Fallback]', err);
      next();
    }
  };
}

export const authRateLimiter = createRateLimiter({
  prefix: 'auth',
  windowSeconds: 60,
  maxRequests: 20,
  message: 'Too many authentication attempts. Please slow down and try again in a minute.',
});

export const passwordResetRateLimiter = createRateLimiter({
  prefix: 'pwd_reset',
  windowSeconds: 300,
  maxRequests: 5,
  message: 'Too many password reset requests. Please wait a few minutes.',
});

export const postCreationRateLimiter = createRateLimiter({
  prefix: 'post_create',
  windowSeconds: 60,
  maxRequests: 15,
  message: 'You are posting too quickly. Please wait a moment before sharing again.',
});
