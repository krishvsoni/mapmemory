import { desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../../../db/client.js';
import { episodeEdgeLinks, episodes } from '../../../db/schema/graph.schema.js';
import type { Episode } from '../graph.types.js';

function toDomain(row: typeof episodes.$inferSelect): Episode {
  return {
    id: row.id,
    spaceId: row.spaceId,
    sequenceNo: row.sequenceNo,
    rawText: row.rawText,
    embedding: row.embedding,
  };
}

export class EpisodeRepository {
  constructor(private readonly db: DbClient) {}

  async nextSequenceNo(spaceId: string): Promise<number> {
    return (await this.latestSequenceNo(spaceId)) + 1;
  }

  async latestSequenceNo(spaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number>`coalesce(max(${episodes.sequenceNo}), 0)` })
      .from(episodes)
      .where(eq(episodes.spaceId, spaceId));
    return row?.max ?? 0;
  }

  async create(spaceId: string, rawText: string, embedding: number[]): Promise<Episode> {
    const sequenceNo = await this.nextSequenceNo(spaceId);
    const [row] = await this.db
      .insert(episodes)
      .values({ spaceId, sequenceNo, rawText, embedding })
      .returning();
    if (!row) throw new Error('Failed to create episode');
    return toDomain(row);
  }

  async linkEdge(episodeId: string, semanticEdgeId: string): Promise<void> {
    await this.db.insert(episodeEdgeLinks).values({ episodeId, semanticEdgeId });
  }

  async edgeCountByEpisode(episodeIds: string[]): Promise<Map<string, number>> {
    if (episodeIds.length === 0) return new Map();
    const rows = await this.db
      .select({ episodeId: episodeEdgeLinks.episodeId, count: sql<number>`count(*)` })
      .from(episodeEdgeLinks)
      .where(sql`${episodeEdgeLinks.episodeId} = ANY(${episodeIds})`)
      .groupBy(episodeEdgeLinks.episodeId);
    return new Map(rows.map((r) => [r.episodeId, Number(r.count)]));
  }

  async episodesByEdgeIds(edgeIds: string[]): Promise<Map<string, string[]>> {
    if (edgeIds.length === 0) return new Map();
    const rows = await this.db
      .select({ episodeId: episodeEdgeLinks.episodeId, edgeId: episodeEdgeLinks.semanticEdgeId })
      .from(episodeEdgeLinks)
      .where(sql`${episodeEdgeLinks.semanticEdgeId} = ANY(${edgeIds})`);

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.episodeId) ?? [];
      list.push(row.edgeId);
      map.set(row.episodeId, list);
    }
    return map;
  }

  async byIds(ids: string[]): Promise<Episode[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(episodes).where(sql`${episodes.id} = ANY(${ids})`);
    return rows.map(toDomain);
  }

  async recent(spaceId: string, limit: number): Promise<Episode[]> {
    const rows = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.spaceId, spaceId))
      .orderBy(desc(episodes.sequenceNo))
      .limit(limit);
    return rows.map(toDomain);
  }
}
