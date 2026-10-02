import { describe, expect, it } from 'vitest';
import { clusterEntityLabels } from './entity-resolver.js';
import type { EntityType } from './graph.types.js';

describe('clusterEntityLabels', () => {
  it('merges labels whose embeddings are near-identical', () => {
    const labels = ['the rusty key', 'rusty key', 'wooden chest'];
    const embeddings = new Map<string, number[]>([
      ['the rusty key', [1, 0, 0]],
      ['rusty key', [0.999, 0.01, 0]],
      ['wooden chest', [0, 1, 0]],
    ]);

    const canonical = clusterEntityLabels(labels, embeddings, new Map(), 0.9);

    expect(canonical.get('the rusty key')).toBe(canonical.get('rusty key'));
    expect(canonical.get('wooden chest')).not.toBe(canonical.get('rusty key'));
    expect(canonical.get('the rusty key')).toBe('rusty key');
  });

  it('leaves dissimilar labels in their own singleton clusters', () => {
    const labels = ['sword', 'shield'];
    const embeddings = new Map<string, number[]>([
      ['sword', [1, 0]],
      ['shield', [0, 1]],
    ]);

    const canonical = clusterEntityLabels(labels, embeddings, new Map(), 0.9);

    expect(canonical.get('sword')).toBe('sword');
    expect(canonical.get('shield')).toBe('shield');
  });

  it('refuses to merge near-identical embeddings when entity types disagree', () => {
    const labels = ['Paris', 'paris'];
    const embeddings = new Map<string, number[]>([
      ['Paris', [1, 0]],
      ['paris', [0.999, 0.01]],
    ]);
    const typeByLabel = new Map<string, EntityType>([
      ['Paris', 'location'],
      ['paris', 'person'],
    ]);

    const canonical = clusterEntityLabels(labels, embeddings, typeByLabel, 0.9);

    expect(canonical.get('Paris')).toBe('Paris');
    expect(canonical.get('paris')).toBe('paris');
  });
});
