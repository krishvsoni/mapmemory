import { describe, expect, it } from 'vitest';
import { confidenceFromCorroboration, invertEpisodeLinks, newestFirst } from './provenance.js';

describe('confidenceFromCorroboration', () => {
  it('grows with each corroboration and stays below one', () => {
    expect(confidenceFromCorroboration(1)).toBe(0.5);
    expect(confidenceFromCorroboration(3)).toBeGreaterThan(confidenceFromCorroboration(2));
    expect(confidenceFromCorroboration(50)).toBeLessThan(1);
  });

  it('treats a missing count as a single observation', () => {
    expect(confidenceFromCorroboration(0)).toBe(0.5);
  });
});

describe('invertEpisodeLinks', () => {
  it('maps edges back to every episode that supports them', () => {
    const inverted = invertEpisodeLinks(new Map([['e1', ['x', 'y']], ['e2', ['x']]]));
    expect(inverted.get('x')).toEqual(['e1', 'e2']);
    expect(inverted.get('y')).toEqual(['e1']);
  });
});

describe('newestFirst', () => {
  it('orders by sequence descending and truncates', () => {
    const sources = [{ sequenceNo: 1 }, { sequenceNo: 9 }, { sequenceNo: 4 }];
    expect(newestFirst(sources, 2)).toEqual([{ sequenceNo: 9 }, { sequenceNo: 4 }]);
  });
});
