import { describe, expect, it } from 'vitest';
import { parseLocomoDate, parseLongMemEvalDate } from './datasets/date-parsing.js';
import { loadLocomo } from './datasets/locomo.loader.js';
import { loadLongMemEval } from './datasets/longmemeval.loader.js';
import { percentile, summarizeByMode } from './metrics.js';
import { chunkSession } from './session-chunker.js';
import { formatContext } from './qa-prompts.js';
import type { QuestionOutcome } from './eval.types.js';

describe('date parsing', () => {
  it('parses LoCoMo session timestamps', () => {
    expect(parseLocomoDate('1:56 pm on 8 May, 2023')?.toISOString()).toBe('2023-05-08T13:56:00.000Z');
    expect(parseLocomoDate('12:05 am on 1 January, 2024')?.toISOString()).toBe('2024-01-01T00:05:00.000Z');
  });

  it('parses LongMemEval timestamps with a weekday', () => {
    expect(parseLongMemEvalDate('2023/05/20 (Sat) 02:21')?.toISOString()).toBe('2023-05-20T02:21:00.000Z');
  });

  it('returns null for unparseable input', () => {
    expect(parseLocomoDate('sometime')).toBeNull();
    expect(parseLongMemEvalDate(undefined)).toBeNull();
  });
});

describe('loadLocomo', () => {
  const raw = [
    {
      sample_id: 'conv-1',
      conversation: {
        speaker_a: 'A',
        speaker_b: 'B',
        session_2: [{ speaker: 'A', text: 'second' }],
        session_2_date_time: '3:00 pm on 9 May, 2023',
        session_1: [{ speaker: 'B', text: 'first' }],
        session_1_date_time: '1:00 pm on 8 May, 2023',
      },
      qa: [
        { question: 'q1', answer: 'a1', evidence: ['D1:3'], category: 4 },
        { question: 'q2', answer: 7, evidence: ['D2:1', 'D1:2'], category: 2 },
        { question: 'q3', category: 5 },
      ],
    },
  ];

  it('orders sessions numerically and maps evidence to session ids', () => {
    const [conversation] = loadLocomo(raw);
    expect(conversation?.sessions.map((s) => s.id)).toEqual(['session_1', 'session_2']);
    expect(conversation?.questions[1]?.evidenceSessionIds).toEqual(['session_2', 'session_1']);
    expect(conversation?.questions[1]?.answer).toBe('7');
  });

  it('drops questions that have no reference answer', () => {
    expect(loadLocomo(raw)[0]?.questions).toHaveLength(2);
  });

  it('filters the adversarial category by default', () => {
    const withAnswer = [{ ...raw[0], qa: [{ question: 'q', answer: 'x', category: 5 }] }];
    expect(loadLocomo(withAnswer)[0]?.questions).toHaveLength(0);
    expect(loadLocomo(withAnswer, { includeAdversarial: true })[0]?.questions).toHaveLength(1);
  });
});

describe('loadLongMemEval', () => {
  it('builds one conversation per question with the question date', () => {
    const [conversation] = loadLongMemEval([
      {
        question_id: 'q1_abs',
        question_type: 'temporal-reasoning',
        question: 'when?',
        answer: 'May',
        question_date: '2023/06/01 (Thu) 10:00',
        haystack_session_ids: ['s2', 's1'],
        haystack_dates: ['2023/05/02 (Tue) 09:00', '2023/05/01 (Mon) 09:00'],
        haystack_sessions: [[{ role: 'user', content: 'later' }], [{ role: 'user', content: 'earlier' }]],
        answer_session_ids: ['s1'],
      },
    ]);
    expect(conversation?.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(conversation?.questions[0]?.category).toBe('temporal-reasoning (abstention)');
    expect(conversation?.questions[0]?.askedAt?.toISOString()).toBe('2023-06-01T10:00:00.000Z');
  });
});

describe('chunkSession', () => {
  const session = {
    id: 's',
    occurredAt: new Date('2023-05-08T13:56:00Z'),
    turns: Array.from({ length: 30 }, (_, i) => ({ speaker: 'A', text: `turn number ${i} `.repeat(10) })),
  };

  it('keeps every chunk within budget and prefixes the date', () => {
    const chunks = chunkSession(session, 600);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(600);
      expect(chunk.text.startsWith('[2023-05-08 13:56 UTC]')).toBe(true);
    }
  });

  it('keeps all turns across chunks', () => {
    const joined = chunkSession(session, 600)
      .map((c) => c.text)
      .join('\n');
    expect(joined).toContain('turn number 29');
  });
});

function outcome(partial: Partial<QuestionOutcome>): QuestionOutcome {
  return {
    questionId: 'q',
    category: 'single-hop',
    mode: 'hybrid',
    question: '',
    gold: '',
    predicted: '',
    correct: true,
    evidenceHit: true,
    retrievalMs: 10,
    factCount: 1,
    episodeCount: 1,
    ...partial,
  };
}

describe('metrics', () => {
  it('computes percentiles by nearest rank', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBe(0);
  });

  it('summarizes accuracy and evidence recall per mode and category', () => {
    const [hybrid, vector] = summarizeByMode([
      outcome({ correct: true }),
      outcome({ correct: false, evidenceHit: false, category: 'temporal' }),
      outcome({ mode: 'vector', correct: false, evidenceHit: null }),
    ]);
    expect(hybrid?.accuracy).toBe(0.5);
    expect(hybrid?.evidenceRecall).toBe(0.5);
    expect(hybrid?.byCategory['temporal']?.accuracy).toBe(0);
    expect(vector?.evidenceRecall).toBeNull();
  });
});

describe('formatContext', () => {
  it('marks superseded facts with their validity window', () => {
    const text = formatContext(
      [
        {
          subject: 'Sam',
          relation: 'lives in',
          object: 'Paris',
          validFrom: new Date('2022-01-01'),
          validTo: new Date('2023-03-01'),
          status: 'superseded',
        },
      ],
      [{ text: 'Sam moved.' }],
    );
    expect(text).toContain('Sam lives in Paris (true 2022-01-01 to 2023-03-01, no longer current)');
    expect(text).toContain('[1] Sam moved.');
  });
});
