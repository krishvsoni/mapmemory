import { computePageRank } from './centrality.js';
import type { GraphService } from './graph.service.js';
import { getRedisConnection } from '../queue/redis-connection.js';
import { CENTRALITY_DEFAULTS } from '../../config/constants.js';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function cacheKey(spaceId: string): string {
  return `centrality:v1:${spaceId}`;
}

export async function invalidateCentralityCache(spaceId: string): Promise<void> {
  try {
    await getRedisConnection().del(cacheKey(spaceId));
  } catch {
    // caching is best-effort; a failed invalidation just means the next read may be briefly stale
  }
}

export class CentralityService {
  constructor(private readonly graph: GraphService) {}

  async computeForSpace(spaceId: string): Promise<Map<string, number>> {
    const cached = await this.readCache(spaceId);
    if (cached) return cached;

    const edges = await this.graph.edges.allActiveForSpace(spaceId);
    const nodeIds = unique(edges.flatMap((e) => [e.sourceNodeId, e.targetNodeId]));
    const ranks = computePageRank(
      nodeIds,
      edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId })),
    );

    await this.writeCache(spaceId, ranks);
    return ranks;
  }

  async topEntities(spaceId: string, limit: number = CENTRALITY_DEFAULTS.topKDefault): Promise<Array<{ nodeId: string; score: number }>> {
    const ranks = await this.computeForSpace(spaceId);
    return [...ranks.entries()]
      .map(([nodeId, score]) => ({ nodeId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async readCache(spaceId: string): Promise<Map<string, number> | null> {
    try {
      const raw = await getRedisConnection().get(cacheKey(spaceId));
      if (!raw) return null;
      return new Map(JSON.parse(raw) as [string, number][]);
    } catch {
      return null;
    }
  }

  private async writeCache(spaceId: string, ranks: Map<string, number>): Promise<void> {
    try {
      await getRedisConnection().set(
        cacheKey(spaceId),
        JSON.stringify([...ranks.entries()]),
        'EX',
        CENTRALITY_DEFAULTS.cacheTtlSeconds,
      );
    } catch {
      // caching is best-effort; a write failure must not fail the caller
    }
  }
}
