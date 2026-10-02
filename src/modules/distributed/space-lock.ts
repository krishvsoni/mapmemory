import { randomUUID } from 'node:crypto';
import { getRedisConnection } from '../queue/redis-connection.js';
import { AppError } from '../../shared/errors.js';

const LOCK_TTL_MS = 30_000;
const ACQUIRE_MAX_WAIT_MS = 25_000;
const ACQUIRE_RETRY_DELAY_MS = 100;

const RELEASE_IF_OWNED_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withSpaceLock<T>(spaceId: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedisConnection();
  const key = `lock:space:${spaceId}`;
  const token = randomUUID();
  const deadline = Date.now() + ACQUIRE_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired === 'OK') {
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE_IF_OWNED_SCRIPT, 1, key, token);
      }
    }
    await sleep(ACQUIRE_RETRY_DELAY_MS);
  }

  throw new AppError('SPACE_BUSY', 'Another ingestion is in progress for this memory space; retry shortly', 503);
}
