import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { toVectorLiteral } from '../../../shared/utils/vector-math.js';
import { buildOrTsQuery } from '../../../shared/utils/lexical-query.js';
import type { DbClient } from '../../../db/client.js';
import { episodeEdgeLinks, episodeSources, episodes, semanticEdges } from '../../../db/schema/graph.schema.js';
import type { Episode, EpisodeKind } from '../graph.types.js';

function toDomain(row: typeof episodes.$inferSelect): Episode {
  return {
    id: row.id,
    spaceId: row.spaceId,
    sequenceNo: row.sequenceNo,
    rawText: row.rawText,
    kind: row.kind as EpisodeKind,
    importance: row.importance,
    accessCount: row.accessCount,
    lastAccessedSequence: row.lastAccessedSequence,
    embedding: row.embedding,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
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

  async create(
    spaceId: string,
    rawText: string,
    embedding: number[],
    importance = 5,
    occurredAt: Date | null = null,
  ): Promise<Episode> {
    const sequenceNo = await this.nextSequenceNo(spaceId);
    const [row] = await this.db
      .insert(episodes)
      .values({ spaceId, sequenceNo, rawText, embedding, importance, occurredAt })
      .returning();
    if (!row) throw new Error('Failed to create episode');
    return toDomain(row);
  }

  async createReflection(
    spaceId: string,
    summaryText: string,
    embedding: number[],
    importance: number,
    sourceEpisodeIds: string[],
  ): Promise<Episode> {
    const sequenceNo = await this.nextSequenceNo(spaceId);
    const [row] = await this.db
      .insert(episodes)
      .values({ spaceId, sequenceNo, rawText: summaryText, embedding, importance, kind: 'reflection' })
      .returning();
    if (!row) throw new Error('Failed to create reflection episode');

    if (sourceEpisodeIds.length > 0) {
      await this.db
        .insert(episodeSources)
        .values(sourceEpisodeIds.map((sourceEpisodeId) => ({ reflectionEpisodeId: row.id, sourceEpisodeId })));
    }
    return toDomain(row);
  }

  async unreflectedRawEpisodes(spaceId: string, limit: number): Promise<Episode[]> {
    const alreadyReflected = this.db
      .select({ id: episodeSources.sourceEpisodeId })
      .from(episodeSources);

    const rows = await this.db
      .select()
      .from(episodes)
      .where(and(eq(episodes.spaceId, spaceId), eq(episodes.kind, 'raw'), notInArray(episodes.id, alreadyReflected)))
      .orderBy(episodes.sequenceNo)
      .limit(limit);
    return rows.map(toDomain);
  }

  async spacesNeedingReflection(minUnreflectedCount: number): Promise<string[]> {
    const alreadyReflected = this.db
      .select({ id: episodeSources.sourceEpisodeId })
      .from(episodeSources);

    const rows = await this.db
      .select({ spaceId: episodes.spaceId, count: sql<number>`count(*)` })
      .from(episodes)
      .where(and(eq(episodes.kind, 'raw'), notInArray(episodes.id, alreadyReflected)))
      .groupBy(episodes.spaceId)
      .having(sql`count(*) >= ${minUnreflectedCount}`);
    return rows.map((r) => r.spaceId);
  }

  async linkEdge(episodeId: string, semanticEdgeId: string): Promise<void> {
    await this.db.insert(episodeEdgeLinks).values({ episodeId, semanticEdgeId });
  }

  async recordAccess(episodeIds: string[], atSequence: number): Promise<void> {
    if (episodeIds.length === 0) return;
    await this.db
      .update(episodes)
      .set({ accessCount: sql`${episodes.accessCount} + 1`, lastAccessedSequence: atSequence })
      .where(inArray(episodes.id, episodeIds));
  }

  async edgeCountByEpisode(episodeIds: string[]): Promise<Map<string, number>> {
    if (episodeIds.length === 0) return new Map();
    const rows = await this.db
      .select({ episodeId: episodeEdgeLinks.episodeId, count: sql<number>`count(*)` })
      .from(episodeEdgeLinks)
      .where(inArray(episodeEdgeLinks.episodeId, episodeIds))
      .groupBy(episodeEdgeLinks.episodeId);
    return new Map(rows.map((r) => [r.episodeId, Number(r.count)]));
  }

  async linkedEdgesByEpisode(edgeIds: string[]): Promise<Map<string, string[]>> {
    if (edgeIds.length === 0) return new Map();
    const rows = await this.db
      .select({ episodeId: episodeEdgeLinks.episodeId, edgeId: episodeEdgeLinks.semanticEdgeId })
      .from(episodeEdgeLinks)
      .where(inArray(episodeEdgeLinks.semanticEdgeId, edgeIds));

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.episodeId) ?? [];
      list.push(row.edgeId);
      map.set(row.episodeId, list);
    }
    return map;
  }

  async entityIdsByEpisodes(episodeIds: string[]): Promise<Map<string, string[]>> {
    if (episodeIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        episodeId: episodeEdgeLinks.episodeId,
        sourceNodeId: semanticEdges.sourceNodeId,
        targetNodeId: semanticEdges.targetNodeId,
      })
      .from(episodeEdgeLinks)
      .innerJoin(semanticEdges, eq(semanticEdges.id, episodeEdgeLinks.semanticEdgeId))
      .where(inArray(episodeEdgeLinks.episodeId, episodeIds));

    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = map.get(row.episodeId) ?? new Set<string>();
      set.add(row.sourceNodeId);
      set.add(row.targetNodeId);
      map.set(row.episodeId, set);
    }
    return new Map([...map.entries()].map(([episodeId, set]) => [episodeId, [...set]]));
  }

  async byIds(ids: string[]): Promise<Episode[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(episodes).where(inArray(episodes.id, ids));
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

  async nearestByEmbedding(spaceId: string, embedding: number[], limit: number): Promise<Episode[]> {
    const literal = toVectorLiteral(embedding);
    const rows = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.spaceId, spaceId))
      .orderBy(sql`${episodes.embedding} <=> ${literal}::vector`)
      .limit(limit);
    return rows.map(toDomain);
  }

  async lexicalSearch(spaceId: string, queryText: string, limit: number): Promise<Episode[]> {
    const tsQuery = buildOrTsQuery(queryText);
    if (!tsQuery) return [];
    const matcher = sql`search_vector @@ to_tsquery('simple', ${tsQuery})`;
    const rows = await this.db
      .select()
      .from(episodes)
      .where(and(eq(episodes.spaceId, spaceId), matcher))
      .orderBy(sql`ts_rank_cd(search_vector, to_tsquery('simple', ${tsQuery})) desc`)
      .limit(limit);
    return rows.map(toDomain);
  }
}
