import { getRedisConnection } from '../queue/redis-connection.js';

const TTL_SECONDS = 60 * 60 * 24;
const PENDING = 'pending';

export type IdempotencyReservation =
  | { status: 'new' }
  | { status: 'pending' }
  | { status: 'done'; jobId: string };

export async function reserveIdempotencyKey(scopeKey: string): Promise<IdempotencyReservation> {
  const redis = getRedisConnection();
  const key = `idempotency:${scopeKey}`;

  const reserved = await redis.set(key, PENDING, 'EX', TTL_SECONDS, 'NX');
  if (reserved === 'OK') return { status: 'new' };

  const value = await redis.get(key);
  if (!value || value === PENDING) return { status: 'pending' };
  return { status: 'done', jobId: value };
}

export async function completeIdempotencyKey(scopeKey: string, jobId: string): Promise<void> {
  await getRedisConnection().set(`idempotency:${scopeKey}`, jobId, 'EX', TTL_SECONDS);
}
