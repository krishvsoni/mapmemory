import { randomUUID } from 'node:crypto';
import { getRedisConnection } from '../queue/redis-connection.js';
import { LLM_CONCURRENCY_DEFAULTS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

const INFLIGHT_SET_KEY = 'llm:global-inflight';

// Evict-check-add happens in one atomic script so concurrent callers can't all read the same pre-acquire count (ZCARD then ZADD as separate commands would race).
const TRY_ACQUIRE_SCRIPT = `
local key = KEYS[1]
local member = ARGV[1]
local now = tonumber(ARGV[2])
local staleCutoff = tonumber(ARGV[3])
local maxConcurrent = tonumber(ARGV[4])
local ttlSeconds = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, staleCutoff)
local count = redis.call('ZCARD', key)
if count < maxConcurrent then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttlSeconds)
  return 1
end
return 0
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquire(memberId: string): Promise<boolean> {
  const now = Date.now();
  const staleCutoff = now - LLM_CONCURRENCY_DEFAULTS.leaseMs;
  const ttlSeconds = Math.ceil(LLM_CONCURRENCY_DEFAULTS.leaseMs / 1000) + 5;

  const result = await getRedisConnection().eval(
    TRY_ACQUIRE_SCRIPT,
    1,
    INFLIGHT_SET_KEY,
    memberId,
    now,
    staleCutoff,
    env.LLM_GLOBAL_MAX_CONCURRENT,
    ttlSeconds,
  );
  return result === 1;
}

async function release(memberId: string): Promise<void> {
  try {
    await getRedisConnection().zrem(INFLIGHT_SET_KEY, memberId);
  } catch {
    // the member will self-expire via the lease TTL even if this fails
  }
}

// Caps concurrent LLM calls across every process sharing this Redis instance; a crashed holder's slot self-expires via the lease age rather than needing explicit cleanup.
export async function withGlobalLlmSlot<T>(fn: () => Promise<T>): Promise<T> {
  const memberId = randomUUID();
  const deadline = Date.now() + LLM_CONCURRENCY_DEFAULTS.maxWaitMs;

  for (;;) {
    if (await tryAcquire(memberId)) break;
    if (Date.now() >= deadline) {
      throw new AppError(
        'LLM_CONCURRENCY_LIMIT',
        'Too many concurrent LLM calls across the cluster; retry shortly',
        503,
      );
    }
    await sleep(LLM_CONCURRENCY_DEFAULTS.pollIntervalMs);
  }

  try {
    return await fn();
  } finally {
    await release(memberId);
  }
}
