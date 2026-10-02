import { Worker } from 'bullmq';
import { buildContainer } from '../container.js';
import { getRedisConnection } from '../modules/queue/redis-connection.js';
import { INGEST_QUEUE_NAME, type IngestJobData } from '../modules/queue/ingest.queue.js';

const container = buildContainer();

const worker = new Worker<IngestJobData>(
  INGEST_QUEUE_NAME,
  async (job) => {
    const result = await container.consolidation.ingest(job.data.spaceId, job.data.observationText);
    return {
      episodeId: result.episode.id,
      createdEdgeCount: result.createdEdges.length,
      supersededEdgeCount: result.supersededEdgeIds.length,
    };
  },
  { connection: getRedisConnection(), concurrency: 4 },
);

worker.on('failed', (job, error) => {
  process.stderr.write(`ingest job ${job?.id ?? 'unknown'} failed: ${error.message}\n`);
});

process.stdout.write('consolidation worker started\n');
