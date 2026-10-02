import { describe, expect, it } from 'vitest';
import { episodicRelevance, recencyWeight } from './episodic-scoring.js';

describe('episodicRelevance', () => {
  it('rewards full overlap with a larger episode over full overlap with a tiny one', () => {
    const bigEpisode = episodicRelevance(3, 3);
    const smallEpisode = episodicRelevance(1, 1);
    expect(bigEpisode).toBeGreaterThan(smallEpisode);
  });

  it('scores zero overlap as zero relevance', () => {
    expect(episodicRelevance(0, 5)).toBe(0);
  });

  it('penalizes partial overlap against total fact count', () => {
    const partial = episodicRelevance(1, 10);
    const full = episodicRelevance(10, 10);
    expect(partial).toBeLessThan(full);
  });
});

describe('recencyWeight', () => {
  it('gives the most recent episode full weight', () => {
    expect(recencyWeight(0, 50)).toBe(1);
  });

  it('halves the weight after exactly one half-life', () => {
    expect(recencyWeight(50, 50)).toBeCloseTo(0.5);
  });

  it('decays older episodes below more recent ones', () => {
    expect(recencyWeight(200, 50)).toBeLessThan(recencyWeight(10, 50));
  });
});
