import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { NotFoundError, ValidationError } from '../../../shared/errors.js';
import { requireSpaceScope } from '../../auth/authorize.middleware.js';
import type { EpisodeKind } from '../../graph/graph.types.js';
import { SNAPSHOT_LIMITS } from '../../graph/snapshot.service.js';
import { scopeFromAsOf } from '../../graph/temporal.js';
import { formatScoredEdges } from './graph.presenter.js';

const snapshotQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(SNAPSHOT_LIMITS.maxEntities).default(SNAPSHOT_LIMITS.defaultEntities),
  asOf: z.string().datetime({ offset: true }).optional(),
  includeHistory: z.enum(['true', 'false']).optional(),
});

export function registerGraphRoutes(app: FastifyInstance, container: Container): void {
  const scoped = { preHandler: [requireSpaceScope()] };

  app.get('/v1/spaces/:spaceId/nodes/:nodeId/facts', scoped, async (request) => {
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

  app.get('/v1/spaces/:spaceId/edges/:edgeId/history', scoped, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId, edgeId } = request.params as { spaceId: string; edgeId: string };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const chain = await container.graph.edges.supersedeChain(edgeId);
    if (chain.length === 0 || chain[0]?.spaceId !== spaceId) throw new NotFoundError('Fact');

    const history = await formatScoredEdges(
      container,
      chain.map((edge) => ({ edge, score: 1, depth: 0 })),
    );
    return { history };
  });

  app.get('/v1/spaces/:spaceId/entities/central', scoped, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const { limit } = request.query as { limit?: string };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const ranked = await container.centrality.topEntities(spaceId, limit ? Number(limit) : undefined);
    const nodes = await container.graph.nodes.findByIds(ranked.map((r) => r.nodeId));
    const labelById = new Map(nodes.map((n) => [n.id, n.label]));

    return {
      entities: ranked.map((r) => ({
        nodeId: r.nodeId,
        label: labelById.get(r.nodeId) ?? r.nodeId,
        centrality: r.score,
      })),
    };
  });

  app.get('/v1/spaces/:spaceId/path', scoped, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');
    if (!from || !to) throw new ValidationError('Both "from" and "to" node ids are required');

    const edges = await container.pathfinding.shortestPath(spaceId, from, to);
    if (edges === null) return { found: false, path: null };

    const path = await formatScoredEdges(
      container,
      edges.map((edge, index) => ({ edge, score: 1, depth: index })),
    );
    return { found: true, path };
  });

  app.get('/v1/spaces/:spaceId/episodes', scoped, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const { limit, kind } = request.query as { limit?: string; kind?: EpisodeKind };

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const episodes = await container.episodes.recent(spaceId, limit ? Number(limit) : 20);
    return { episodes: kind ? episodes.filter((e) => e.kind === kind) : episodes };
  });

  app.get('/v1/spaces/:spaceId/graph', scoped, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const query = snapshotQuerySchema.parse(request.query);

    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');

    const scope = scopeFromAsOf(query.asOf ? new Date(query.asOf) : undefined, query.includeHistory === 'true');
    return container.snapshots.snapshot(spaceId, query.limit, scope);
  });
}
