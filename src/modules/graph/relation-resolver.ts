import type { DbClient } from '../../db/client.js';
import { RelationRepository } from './repository/relation.repository.js';
import { normalizeLabel } from './normalize.js';
import { cosineSimilarity } from '../../shared/utils/vector-math.js';
import { RELATION_RESOLUTION } from '../../config/constants.js';

export class RelationResolver {
  private readonly relations: RelationRepository;

  constructor(db: DbClient) {
    this.relations = new RelationRepository(db);
  }

  async resolve(spaceId: string, relationText: string, embedding: number[]): Promise<string> {
    const normalized = normalizeLabel(relationText);
    const exact = await this.relations.findByNormalizedLabel(spaceId, normalized);
    if (exact) return exact.canonicalLabel;

    const candidates = await this.relations.nearestByEmbedding(spaceId, embedding, 5);
    for (const candidate of candidates) {
      if (!candidate.embedding) continue;
      if (cosineSimilarity(candidate.embedding, embedding) >= RELATION_RESOLUTION.mergeSimilarityThreshold) {
        return candidate.canonicalLabel;
      }
    }

    const created = await this.relations.create(spaceId, relationText, embedding);
    return created.canonicalLabel;
  }
}
