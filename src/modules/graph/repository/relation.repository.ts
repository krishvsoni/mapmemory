import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../../../db/client.js';
import { relationVocabulary } from '../../../db/schema/graph.schema.js';
import { toVectorLiteral } from '../../../shared/utils/vector-math.js';
import { normalizeLabel } from '../normalize.js';

export interface RelationVocabularyEntry {
  id: string;
  canonicalLabel: string;
  embedding: number[] | null;
}

function toDomain(row: typeof relationVocabulary.$inferSelect): RelationVocabularyEntry {
  return { id: row.id, canonicalLabel: row.canonicalLabel, embedding: row.embedding };
}

export class RelationRepository {
  constructor(private readonly db: DbClient) {}

  async findByNormalizedLabel(spaceId: string, normalized: string): Promise<RelationVocabularyEntry | null> {
    const [row] = await this.db
      .select()
      .from(relationVocabulary)
      .where(and(eq(relationVocabulary.spaceId, spaceId), eq(relationVocabulary.normalizedLabel, normalized)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async nearestByEmbedding(spaceId: string, embedding: number[], limit: number): Promise<RelationVocabularyEntry[]> {
    const literal = toVectorLiteral(embedding);
    const rows = await this.db
      .select()
      .from(relationVocabulary)
      .where(eq(relationVocabulary.spaceId, spaceId))
      .orderBy(sql`${relationVocabulary.embedding} <=> ${literal}::vector`)
      .limit(limit);
    return rows.map(toDomain);
  }

  async create(spaceId: string, canonicalLabel: string, embedding: number[]): Promise<RelationVocabularyEntry> {
    const [row] = await this.db
      .insert(relationVocabulary)
      .values({ spaceId, canonicalLabel, normalizedLabel: normalizeLabel(canonicalLabel), embedding })
      .returning();
    if (!row) throw new Error('Failed to create relation vocabulary entry');
    return toDomain(row);
  }
}
