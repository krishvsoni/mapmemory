import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';
import { formatScoredEdges } from './graph.presenter.js';

export function registerGraphRoutes(app: FastifyInstance, container: Container): void {
  app.get('/v1/spaces/:spaceId/nodes/:nodeId/facts', async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId, nodeId } = request.params as { spaceId: string; nodeId: string };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const edges = await container.graph.activeFactsAbout(spaceId, [nodeId]);
    const facts = await formatScoredEdges(
      container,
      edges.map((edge) => ({ edge, score: 1, depth: 0 })),
    );
    return { facts };
  });

  app.get('/v1/spaces/:spaceId/episodes', async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const { limit } = request.query as { limit?: string };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const episodes = await container.episodes.recent(spaceId, limit ? Number(limit) : 20);
    return { episodes };
  });
}
