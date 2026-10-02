import { Queue } from 'bullmq';
import { getRedisConnection } from './redis-connection.js';

export const REFLECTION_QUEUE_NAME = 'memory-reflection-sweep';

let queue: Queue | undefined;

export function getReflectionQueue(): Queue {
  queue ??= new Queue(REFLECTION_QUEUE_NAME, { connection: getRedisConnection() });
  return queue;
}
