import { describe, expect, it } from 'vitest';
import { computePageRank, normalizeScores } from './centrality.js';

describe('computePageRank', () => {
  it('ranks a hub node above its leaf neighbors', () => {
    const nodeIds = ['hub', 'leaf1', 'leaf2', 'leaf3'];
    const edges = [
      { source: 'hub', target: 'leaf1' },
      { source: 'hub', target: 'leaf2' },
      { source: 'hub', target: 'leaf3' },
    ];

    const ranks = computePageRank(nodeIds, edges);

    expect(ranks.get('hub')).toBeGreaterThan(ranks.get('leaf1') ?? 0);
    expect(ranks.get('hub')).toBeGreaterThan(ranks.get('leaf2') ?? 0);
  });

  it('gives all nodes equal rank in a symmetric cycle', () => {
    const nodeIds = ['a', 'b', 'c'];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ];

    const ranks = computePageRank(nodeIds, edges);
    const a = ranks.get('a') ?? 0;
    const b = ranks.get('b') ?? 0;
    const c = ranks.get('c') ?? 0;
    expect(a).toBeCloseTo(b, 5);
    expect(b).toBeCloseTo(c, 5);
  });

  it('returns an empty map for no nodes', () => {
    expect(computePageRank([], []).size).toBe(0);
  });

  it('does not leak rank mass through dangling (degree-zero) nodes', () => {
    const nodeIds = ['connected1', 'connected2', 'isolated'];
    const edges = [{ source: 'connected1', target: 'connected2' }];

    const ranks = computePageRank(nodeIds, edges);
    const total = [...ranks.values()].reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('normalizeScores', () => {
  it('scales the top score to 1', () => {
    const normalized = normalizeScores(new Map([['a', 0.4], ['b', 0.2]]));
    expect(normalized.get('a')).toBe(1);
    expect(normalized.get('b')).toBe(0.5);
  });
});
