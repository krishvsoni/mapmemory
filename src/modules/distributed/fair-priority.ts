import { getRedisConnection } from '../queue/redis-connection.js';

const WINDOW_SECONDS = 60;
const MAX_PRIORITY = 1000;

export async function computeFairPriority(tenantId: string): Promise<number> {
  const redis = getRedisConnection();
  const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `fairshare:${tenantId}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return Math.min(count, MAX_PRIORITY);
}
