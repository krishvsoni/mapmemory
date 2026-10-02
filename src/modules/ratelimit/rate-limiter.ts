import { getRedisConnection } from '../queue/redis-connection.js';
import { RATE_LIMIT_DEFAULTS } from '../../config/constants.js';
import { TooManyRequestsError } from '../../shared/errors.js';

export async function enforceRateLimit(
  tenantId: string,
  limit: number = RATE_LIMIT_DEFAULTS.requestsPerMinute,
  windowSeconds: number = RATE_LIMIT_DEFAULTS.windowSeconds,
): Promise<void> {
  const redis = getRedisConnection();
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `ratelimit:${tenantId}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (count > limit) {
    throw new TooManyRequestsError(`Rate limit of ${limit} requests per ${windowSeconds}s exceeded`);
  }
}
