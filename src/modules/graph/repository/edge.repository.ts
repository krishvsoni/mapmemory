import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { DbClient } from '../../../db/client.js';
import { semanticEdges } from '../../../db/schema/graph.schema.js';
import type { SemanticEdge } from '../graph.types.js';

function toDomain(row: typeof semanticEdges.$inferSelect): SemanticEdge {
  return {
    id: row.id,
    spaceId: row.spaceId,
    sourceNodeId: row.sourceNodeId,
    relation: row.relation,
    targetNodeId: row.targetNodeId,
    embedding: row.embedding,
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
  ): Promise<SemanticEdge> {
    const [row] = await this.db
      .insert(semanticEdges)
      .values({ spaceId, sourceNodeId, relation, targetNodeId, embedding })
      .returning();
    if (!row) throw new Error('Failed to create semantic edge');
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
          or(
            sql`${semanticEdges.sourceNodeId} = ANY(${nodeIds})`,
            sql`${semanticEdges.targetNodeId} = ANY(${nodeIds})`,
          ),
        ),
      );
    return rows.map(toDomain);
  }

  async byIds(ids: string[]): Promise<SemanticEdge[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(semanticEdges)
      .where(sql`${semanticEdges.id} = ANY(${ids})`);
    return rows.map(toDomain);
  }

  async deleteSupersededOlderThan(cutoff: Date): Promise<number> {
    const deleted = await this.db
      .delete(semanticEdges)
      .where(and(isNotNull(semanticEdges.supersededByEdgeId), lt(semanticEdges.updatedAt, cutoff)))
      .returning({ id: semanticEdges.id });
    return deleted.length;
  }
}
