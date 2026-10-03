export interface FusedItem<T> {
  item: T;
  score: number;
}

export interface FusionOptions {
  k?: number;
  weights?: number[];
}

const DEFAULT_RRF_K = 60;

export function reciprocalRankFusion<T>(
  rankedLists: T[][],
  keyOf: (item: T) => string,
  options: FusionOptions = {},
): FusedItem<T>[] {
  const k = options.k ?? DEFAULT_RRF_K;
  const fused = new Map<string, FusedItem<T>>();

  rankedLists.forEach((list, listIndex) => {
    const weight = options.weights?.[listIndex] ?? 1;
    list.forEach((item, rank) => {
      const key = keyOf(item);
      const contribution = weight / (k + rank + 1);
      const existing = fused.get(key);
      if (existing) existing.score += contribution;
      else fused.set(key, { item, score: contribution });
    });
  });

  return [...fused.values()].sort((a, b) => b.score - a.score);
}
