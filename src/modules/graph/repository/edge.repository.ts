import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { DbClient } from '../../../db/client.js';
import { semanticEdges } from '../../../db/schema/graph.schema.js';
import type { SemanticEdge } from '../graph.types.js';

function toDomain(row: typeof semanticEdges.$inferSelect): SemanticEdge {
  return {
    id: row.id,
    spaceId: row.spaceId,
    sourceNodeId: row.sourceNodeId,
    relation: row.relation,
    canonicalRelation: row.canonicalRelation,
    targetNodeId: row.targetNodeId,
    embedding: row.embedding,
    corroborationCount: row.corroborationCount,
    supersededByEdgeId: row.supersededByEdgeId,
  };
}

export class EdgeRepository {
  constructor(private readonly db: DbClient) {}

  async create(
    spaceId: string,
    sourceNodeId: string,
    relation: string,
    targetNodeId: string,
    embedding: number[],
    canonicalRelation?: string,
  ): Promise<SemanticEdge> {
    const [row] = await this.db
      .insert(semanticEdges)
      .values({ spaceId, sourceNodeId, relation, canonicalRelation: canonicalRelation ?? null, targetNodeId, embedding })
      .returning();
    if (!row) throw new Error('Failed to create semantic edge');
    return toDomain(row);
  }

  async findActiveMatch(
    spaceId: string,
    sourceNodeId: string,
    canonicalRelation: string,
    targetNodeId: string,
  ): Promise<SemanticEdge | null> {
    const [row] = await this.db
      .select()
      .from(semanticEdges)
      .where(
        and(
          eq(semanticEdges.spaceId, spaceId),
          eq(semanticEdges.sourceNodeId, sourceNodeId),
          eq(semanticEdges.targetNodeId, targetNodeId),
          eq(semanticEdges.canonicalRelation, canonicalRelation),
          isNull(semanticEdges.supersededByEdgeId),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async corroborate(edgeId: string): Promise<SemanticEdge> {
    const [row] = await this.db
      .update(semanticEdges)
      .set({ corroborationCount: sql`${semanticEdges.corroborationCount} + 1`, updatedAt: new Date() })
      .where(eq(semanticEdges.id, edgeId))
      .returning();
    if (!row) throw new Error('Failed to corroborate semantic edge');
    return toDomain(row);
  }

  async supersede(oldEdgeId: string, newEdgeId: string): Promise<void> {
    await this.db
      .update(semanticEdges)
      .set({ supersededByEdgeId: newEdgeId, updatedAt: new Date() })
      .where(eq(semanticEdges.id, oldEdgeId));
  }

  async activeEdgesTouchingNodes(spaceId: string, nodeIds: string[]): Promise<SemanticEdge[]> {
    if (nodeIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(semanticEdges)
      .where(
        and(
          eq(semanticEdges.spaceId, spaceId),
          isNull(semanticEdges.supersededByEdgeId),
          or(inArray(semanticEdges.sourceNodeId, nodeIds), inArray(semanticEdges.targetNodeId, nodeIds)),
        ),
      );
    return rows.map(toDomain);
  }

  async allActiveForSpace(spaceId: string): Promise<SemanticEdge[]> {
    const rows = await this.db
      .select()
      .from(semanticEdges)
      .where(and(eq(semanticEdges.spaceId, spaceId), isNull(semanticEdges.supersededByEdgeId)));
    return rows.map(toDomain);
  }

  async byIds(ids: string[]): Promise<SemanticEdge[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(semanticEdges)
      .where(inArray(semanticEdges.id, ids));
    return rows.map(toDomain);
  }

  async supersedeChain(edgeId: string): Promise<SemanticEdge[]> {
    const chain: SemanticEdge[] = [];
    let current = (await this.byIds([edgeId]))[0] ?? null;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      const [next] = current.supersededByEdgeId ? await this.byIds([current.supersededByEdgeId]) : [];
      current = next ?? null;
    }
    return chain;
  }

  async deleteSupersededOlderThan(cutoff: Date): Promise<number> {
    const deleted = await this.db
      .delete(semanticEdges)
      .where(and(isNotNull(semanticEdges.supersededByEdgeId), lt(semanticEdges.updatedAt, cutoff)))
      .returning({ id: semanticEdges.id });
    return deleted.length;
  }
}
