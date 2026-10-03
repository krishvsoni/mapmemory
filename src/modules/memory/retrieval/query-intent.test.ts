import { describe, expect, it } from 'vitest';
import { classifyQueryIntent, profileFor } from './query-intent.js';

describe('classifyQueryIntent', () => {
  it.each([
    ['When did Melanie go camping?', 'temporal'],
    ['Where did Sam live before Berlin?', 'temporal'],
    ['What did she do in May 2023?', 'temporal'],
    ['How is Alice related to Bob?', 'relational'],
    ['What is the connection between Acme and Globex?', 'relational'],
    ['Summarize what you know about Priya', 'summary'],
    ['What is Bob\'s favourite color?', 'factual'],
  ])('%s -> %s', (query, expected) => {
    expect(classifyQueryIntent(query)).toBe(expected);
  });

  it('prefers relational over temporal when both appear', () => {
    expect(classifyQueryIntent('How is Alice related to Bob since 2020?')).toBe('relational');
  });
});

describe('profileFor', () => {
  it('searches deeper for relational and keeps history for temporal', () => {
    expect(profileFor('relational').depth).toBeGreaterThan(profileFor('factual').depth);
    expect(profileFor('temporal').includeHistory).toBe(true);
    expect(profileFor('factual').includeHistory).toBe(false);
  });
});
