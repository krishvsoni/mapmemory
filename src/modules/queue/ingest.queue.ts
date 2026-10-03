import { Queue } from 'bullmq';
import { getRedisConnection } from './redis-connection.js';

export interface IngestJobData {
  spaceId: string;
  observationText: string;
  occurredAt?: string;
}

export const INGEST_QUEUE_NAME = 'memory-ingest';

let queue: Queue<IngestJobData> | undefined;

export function getIngestQueue(): Queue<IngestJobData> {
  queue ??= new Queue<IngestJobData>(INGEST_QUEUE_NAME, {
    connection: getRedisConnection(),
  });
  return queue;
}
