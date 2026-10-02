import { Worker } from 'bullmq';
import { buildContainer } from '../container.js';
import { env } from '../config/env.js';
import { getRedisConnection } from '../modules/queue/redis-connection.js';
import { getReflectionQueue, REFLECTION_QUEUE_NAME } from '../modules/queue/reflection.queue.js';

const container = buildContainer();

async function scheduleRepeatingSweep(): Promise<void> {
  await getReflectionQueue().add(
    'sweep',
    {},
    { repeat: { every: env.REFLECTION_SWEEP_INTERVAL_MS }, jobId: 'reflection-sweep' },
  );
}

const worker = new Worker(
  REFLECTION_QUEUE_NAME,
  async () => {
    const results = await container.reflection.sweepAllSpaces();
    return {
      spacesChecked: results.length,
      spacesReflected: results.filter((r) => r.reflection !== null).length,
    };
  },
  { connection: getRedisConnection(), concurrency: 1 },
);

worker.on('failed', (job, error) => {
  process.stderr.write(`reflection sweep job ${job?.id ?? 'unknown'} failed: ${error.message}\n`);
});

scheduleRepeatingSweep().catch((error: unknown) => {
  process.stderr.write(`failed to schedule reflection sweep: ${String(error)}\n`);
});

process.stdout.write('reflection worker started\n');
