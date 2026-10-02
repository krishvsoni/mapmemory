import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  connection ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}
