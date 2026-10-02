import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { withGlobalLlmSlot } from '../modules/llm/global-concurrency.js';
import { getRedisConnection } from '../modules/queue/redis-connection.js';

const INFLIGHT_SET_KEY = 'llm:global-inflight';

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const probe = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    await probe.query('SELECT 1');
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDatabaseReachable();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!dbAvailable)('global LLM concurrency semaphore (real Redis)', () => {
  beforeAll(async () => {
    await getRedisConnection().del(INFLIGHT_SET_KEY);
  });

  afterAll(async () => {
    await getRedisConnection().del(INFLIGHT_SET_KEY);
  });

  it('never lets more than LLM_GLOBAL_MAX_CONCURRENT calls run at once, and all callers eventually complete', async () => {
    let current = 0;
    let peak = 0;
    const attempts = env.LLM_GLOBAL_MAX_CONCURRENT + 5;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        withGlobalLlmSlot(async () => {
          current += 1;
          peak = Math.max(peak, current);
          await sleep(100);
          current -= 1;
          return true;
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(peak).toBeLessThanOrEqual(env.LLM_GLOBAL_MAX_CONCURRENT);
    expect(succeeded).toBe(attempts);
  });

  it('releases the slot even when the wrapped call throws', async () => {
    await expect(
      withGlobalLlmSlot(async () => {
        throw new Error('simulated provider failure');
      }),
    ).rejects.toThrow('simulated provider failure');

    const count = await getRedisConnection().zcard(INFLIGHT_SET_KEY);
    expect(count).toBe(0);
  });

  it('rejects with a 503 AppError when the cluster is saturated past the wait window', async () => {
    const redis = getRedisConnection();
    const blockers = Array.from({ length: env.LLM_GLOBAL_MAX_CONCURRENT }, (_, i) => `blocker-${i}`);
    await Promise.all(blockers.map((id) => redis.zadd(INFLIGHT_SET_KEY, Date.now(), id)));

    await expect(
      withGlobalLlmSlot(async () => true),
    ).rejects.toMatchObject({ statusCode: 503, code: 'LLM_CONCURRENCY_LIMIT' });

    await Promise.all(blockers.map((id) => redis.zrem(INFLIGHT_SET_KEY, id)));
  }, 15_000);
});
