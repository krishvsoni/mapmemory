import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';
import { getIngestQueue } from '../../queue/ingest.queue.js';
import { computeFairPriority } from '../../distributed/fair-priority.js';
import { completeIdempotencyKey, reserveIdempotencyKey } from '../../distributed/idempotency.js';
import { formatScoredEdges } from './graph.presenter.js';

const ingestSchema = z.object({ text: z.string().min(1) });

const retrieveSchema = z.object({
  query: z.string().min(1),
  depth: z.number().int().positive().max(5).optional(),
  width: z.number().int().positive().max(20).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

async function assertSpaceOwnership(container: Container, tenantId: string, spaceId: string): Promise<void> {
  const space = await container.tenants.spaces.findById(tenantId, spaceId);
  if (!space) throw new NotFoundError('Memory space');
}

async function enqueueIngest(tenantId: string, spaceId: string, text: string): Promise<string> {
  const priority = await computeFairPriority(tenantId);
  const job = await getIngestQueue().add('ingest', { spaceId, observationText: text }, { priority });
  return job.id as string;
}

export function registerMemoryRoutes(app: FastifyInstance, container: Container): void {
  app.post('/v1/spaces/:spaceId/episodes', async (request, reply) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    await assertSpaceOwnership(container, tenantId, spaceId);
    const body = ingestSchema.parse(request.body);

    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
      const scopeKey = `${tenantId}:${spaceId}:${idempotencyKey}`;
      const reservation = await reserveIdempotencyKey(scopeKey);

      if (reservation.status === 'done') {
        reply.code(202).send({ jobId: reservation.jobId, deduplicated: true });
        return;
      }
      if (reservation.status === 'pending') {
        reply
          .code(409)
          .send({ code: 'IDEMPOTENCY_KEY_IN_FLIGHT', message: 'A request with this key is already in progress' });
        return;
      }

      const jobId = await enqueueIngest(tenantId, spaceId, body.text);
      await completeIdempotencyKey(scopeKey, jobId);
      reply.code(202).send({ jobId });
      return;
    }

    const jobId = await enqueueIngest(tenantId, spaceId, body.text);
    reply.code(202).send({ jobId });
  });

  app.get('/v1/jobs/:jobId', async (request) => {
    const { jobId } = request.params as { jobId: string };
    const job = await getIngestQueue().getJob(jobId);
    if (!job) throw new NotFoundError('Job');
    const state = await job.getState();
    return { jobId: job.id, state, result: job.returnvalue };
  });

  app.post('/v1/spaces/:spaceId/reflect', async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    await assertSpaceOwnership(container, tenantId, spaceId);

    const reflection = await container.reflection.reflect(spaceId);
    return { reflection };
  });

  app.post('/v1/spaces/:spaceId/retrieve', async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    await assertSpaceOwnership(container, tenantId, spaceId);

    const body = retrieveSchema.parse(request.body);
    const result = await container.retrieval.retrieve(spaceId, body.query, {
      depth: body.depth,
      width: body.width,
      minSimilarity: body.minSimilarity,
    });

    const facts = await formatScoredEdges(container, result.facts);
    return {
      facts,
      episodes: result.episodes.map((e) => ({
        episodeId: e.episode.id,
        sequenceNo: e.episode.sequenceNo,
        kind: e.episode.kind,
        text: e.episode.rawText,
        importance: e.episode.importance,
        relevance: e.relevance,
      })),
    };
  });
}
