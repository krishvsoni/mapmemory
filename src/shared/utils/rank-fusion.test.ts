import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rank-fusion.js';

const id = (s: string): string => s;

describe('reciprocalRankFusion', () => {
  it('promotes items that appear in several lists over a single top hit', () => {
    const fused = reciprocalRankFusion([['a', 'b', 'c'], ['d', 'b', 'e']], id);
    expect(fused[0]?.item).toBe('b');
  });

  it('keeps a lone first-place item ahead of a lone second-place item', () => {
    const fused = reciprocalRankFusion([['a', 'b']], id);
    expect(fused.map((f) => f.item)).toEqual(['a', 'b']);
  });

  it('applies per-list weights', () => {
    const fused = reciprocalRankFusion([['a'], ['b']], id, { weights: [1, 3] });
    expect(fused[0]?.item).toBe('b');
  });

  it('returns nothing for empty input', () => {
    expect(reciprocalRankFusion<string>([[], []], id)).toEqual([]);
  });
});
