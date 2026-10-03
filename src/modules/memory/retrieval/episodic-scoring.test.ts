import { describe, expect, it } from 'vitest';
import { compositeEpisodicScore, episodicRelevance, lexicalSignalFromRank, recencyWeight, reinforcementBoost } from './episodic-scoring.js';

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

describe('reinforcementBoost', () => {
  it('is zero for a never-accessed episode', () => {
    expect(reinforcementBoost(0)).toBe(0);
  });

  it('grows with access count but stays below 1', () => {
    expect(reinforcementBoost(100)).toBeGreaterThan(reinforcementBoost(1));
    expect(reinforcementBoost(100)).toBeLessThan(1);
  });
});

describe('compositeEpisodicScore', () => {
  it('ranks a highly important, frequently recalled, on-topic memory above a trivial stale one', () => {
    const strong = compositeEpisodicScore({
      relevance: 1,
      querySimilarity: 0.9,
      importance: 10,
      ageInSteps: 0,
      halfLifeSteps: 50,
      accessCount: 20,
    });
    const weak = compositeEpisodicScore({
      relevance: 0.1,
      querySimilarity: 0,
      importance: 1,
      ageInSteps: 500,
      halfLifeSteps: 50,
      accessCount: 0,
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it('rewards direct query-embedding similarity independent of fact overlap', () => {
    const base = {
      relevance: 0.2,
      importance: 5,
      ageInSteps: 10,
      halfLifeSteps: 50,
      accessCount: 1,
    };
    const onTopic = compositeEpisodicScore({ ...base, querySimilarity: 0.9 });
    const offTopic = compositeEpisodicScore({ ...base, querySimilarity: 0 });
    expect(onTopic).toBeGreaterThan(offTopic);
  });

  it('never lets a negative query similarity drag the score below the zero-similarity baseline', () => {
    const base = { relevance: 0.2, importance: 5, ageInSteps: 10, halfLifeSteps: 50, accessCount: 1 };
    const negative = compositeEpisodicScore({ ...base, querySimilarity: -0.8 });
    const zero = compositeEpisodicScore({ ...base, querySimilarity: 0 });
    expect(negative).toBe(zero);
  });
});

describe('lexical signal', () => {
  const inputs = { relevance: 0.2, querySimilarity: 0.3, importance: 5, ageInSteps: 0, halfLifeSteps: 50, accessCount: 0 };

  it('adds nothing when no lexical signal is supplied', () => {
    expect(compositeEpisodicScore({ ...inputs, lexicalSignal: 0 })).toBe(compositeEpisodicScore(inputs));
  });

  it('rewards an episode that matched lexically', () => {
    expect(compositeEpisodicScore({ ...inputs, lexicalSignal: 1 })).toBeGreaterThan(compositeEpisodicScore(inputs));
  });

  it('decays the signal with lexical rank', () => {
    expect(lexicalSignalFromRank(0)).toBeGreaterThan(lexicalSignalFromRank(3));
  });
});
