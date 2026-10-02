import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../../../db/client.js';
import { semanticNodes } from '../../../db/schema/graph.schema.js';
import { toVectorLiteral } from '../../../shared/utils/vector-math.js';
import { normalizeLabel } from '../normalize.js';
import type { EntityType, SemanticNode } from '../graph.types.js';

function toDomain(row: typeof semanticNodes.$inferSelect): SemanticNode {
  return {
    id: row.id,
    spaceId: row.spaceId,
    label: row.label,
    normalizedLabel: row.normalizedLabel,
    entityType: (row.entityType as EntityType | null) ?? null,
    embedding: row.embedding,
  };
}

export class NodeRepository {
  constructor(private readonly db: DbClient) {}

  async findByLabel(spaceId: string, label: string): Promise<SemanticNode | null> {
    const normalized = normalizeLabel(label);
    const [row] = await this.db
      .select()
      .from(semanticNodes)
      .where(and(eq(semanticNodes.spaceId, spaceId), eq(semanticNodes.normalizedLabel, normalized)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<SemanticNode[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(semanticNodes)
      .where(sql`${semanticNodes.id} = ANY(${ids})`);
    return rows.map(toDomain);
  }

  async create(spaceId: string, label: string, embedding: number[], entityType?: EntityType): Promise<SemanticNode> {
    const [row] = await this.db
      .insert(semanticNodes)
      .values({
        spaceId,
        label,
        normalizedLabel: normalizeLabel(label),
        entityType: entityType ?? null,
        embedding,
      })
      .returning();
    if (!row) throw new Error('Failed to create semantic node');
    return toDomain(row);
  }

  async nearestByEmbedding(spaceId: string, embedding: number[], limit: number): Promise<SemanticNode[]> {
    const literal = toVectorLiteral(embedding);
    const rows = await this.db
      .select()
      .from(semanticNodes)
      .where(eq(semanticNodes.spaceId, spaceId))
      .orderBy(sql`${semanticNodes.embedding} <=> ${literal}::vector`)
      .limit(limit);
    return rows.map(toDomain);
  }
}
