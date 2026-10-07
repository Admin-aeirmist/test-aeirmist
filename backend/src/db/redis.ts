import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  reconnectOnError(err) {
    console.warn('[Redis Reconnect Notice]', err.message);
    return true;
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

redis.on('connect', () => {
  console.log('✅ [Redis] Connected successfully');
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === 'PONG';
  } catch (err) {
    console.error('[Redis Health Check Failed]', err);
    return false;
  }
}
