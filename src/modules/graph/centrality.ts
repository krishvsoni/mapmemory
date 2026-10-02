import { CENTRALITY_DEFAULTS } from '../../config/constants.js';

export interface GraphEdgeRef {
  source: string;
  target: string;
}

export function computePageRank(
  nodeIds: string[],
  edges: GraphEdgeRef[],
  damping: number = CENTRALITY_DEFAULTS.dampingFactor,
  iterations: number = CENTRALITY_DEFAULTS.iterations,
): Map<string, number> {
  const n = nodeIds.length;
  if (n === 0) return new Map();

  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }

  let ranks = new Map<string, number>(nodeIds.map((id) => [id, 1 / n]));

  for (let iter = 0; iter < iterations; iter += 1) {
    let danglingMass = 0;
    for (const id of nodeIds) {
      if ((adjacency.get(id)?.length ?? 0) === 0) danglingMass += ranks.get(id) ?? 0;
    }

    const baseRank = (1 - damping) / n + (damping * danglingMass) / n;
    const next = new Map<string, number>(nodeIds.map((id) => [id, baseRank]));

    for (const id of nodeIds) {
      const neighbors = adjacency.get(id) ?? [];
      if (neighbors.length === 0) continue;
      const share = (damping * (ranks.get(id) ?? 0)) / neighbors.length;
      for (const neighbor of neighbors) {
        next.set(neighbor, (next.get(neighbor) ?? 0) + share);
      }
    }
    ranks = next;
  }

  return ranks;
}

export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  const max = Math.max(...scores.values(), 0);
  if (max === 0) return scores;
  return new Map([...scores.entries()].map(([id, score]) => [id, score / max]));
}
