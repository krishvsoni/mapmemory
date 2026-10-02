import { UnionFind } from '../../shared/utils/union-find.js';
import { cosineSimilarity } from '../../shared/utils/vector-math.js';
import { ENTITY_RESOLUTION } from '../../config/constants.js';

function pickCanonical(members: string[]): string {
  return [...members].sort((a, b) => a.length - b.length || a.localeCompare(b))[0] as string;
}

export function clusterEntityLabels(
  labels: string[],
  embeddingByLabel: Map<string, number[]>,
  threshold: number = ENTITY_RESOLUTION.mergeSimilarityThreshold,
): Map<string, string> {
  const uf = new UnionFind<string>();
  labels.forEach((label) => uf.makeSet(label));

  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const labelA = labels[i] as string;
      const labelB = labels[j] as string;
      const embeddingA = embeddingByLabel.get(labelA);
      const embeddingB = embeddingByLabel.get(labelB);
      if (!embeddingA || !embeddingB) continue;
      if (cosineSimilarity(embeddingA, embeddingB) >= threshold) {
        uf.union(labelA, labelB);
      }
    }
  }

  const canonicalByLabel = new Map<string, string>();
  for (const members of uf.groups().values()) {
    const canonical = pickCanonical(members);
    for (const member of members) canonicalByLabel.set(member, canonical);
  }
  return canonicalByLabel;
}
