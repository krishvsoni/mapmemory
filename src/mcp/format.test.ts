import { describe, expect, it } from 'vitest';
import type { McpFact } from './api-client.js';
import { formatHistory, formatRecall } from './format.js';

const current: McpFact = {
  edgeId: 'e1',
  subject: 'Sam',
  relation: 'lives in',
  object: 'Berlin',
  status: 'current',
  validFrom: '2023-03-01T00:00:00.000Z',
  validTo: null,
  confidence: 0.75,
};

const old: McpFact = {
  ...current,
  edgeId: 'e0',
  object: 'Paris',
  status: 'superseded',
  validFrom: '2020-01-01T00:00:00.000Z',
  validTo: '2023-03-01T00:00:00.000Z',
};

describe('formatRecall', () => {
  it('renders facts with validity and ids, then source passages', () => {
    const out = formatRecall({
      intent: 'factual',
      facts: [current],
      episodes: [{ episodeId: 'x', kind: 'raw', occurredAt: '2023-03-02T10:00:00.000Z', text: 'Sam moved.' }],
    });
    expect(out).toContain('- Sam lives in Berlin [current, since 2023-03-01; confidence 0.75; id e1]');
    expect(out).toContain('[2023-03-02] Sam moved.');
  });

  it('says so when nothing was found', () => {
    expect(formatRecall({ intent: 'factual', facts: [], episodes: [] })).toBe('No relevant memories found.');
  });

  it('labels reflection passages as summaries', () => {
    const out = formatRecall({
      intent: 'summary',
      facts: [],
      episodes: [{ episodeId: 'r', kind: 'reflection', occurredAt: '2023-04-01T00:00:00.000Z', text: 'Pattern.' }],
    });
    expect(out).toContain('[2023-04-01, summary] Pattern.');
  });
});

describe('formatHistory', () => {
  it('shows the superseded window', () => {
    expect(formatHistory([old, current])).toContain('superseded, was true 2020-01-01 to 2023-03-01');
  });
});
