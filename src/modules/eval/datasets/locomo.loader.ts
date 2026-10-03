import { z } from 'zod';
import type { EvalConversation, EvalQuestion, EvalSession } from '../eval.types.js';
import { parseLocomoDate } from './date-parsing.js';

const CATEGORY_NAMES: Record<number, string> = {
  1: 'multi-hop',
  2: 'temporal',
  3: 'open-domain',
  4: 'single-hop',
  5: 'adversarial',
};

const ADVERSARIAL_CATEGORY = 5;

const turnSchema = z.object({ speaker: z.string(), text: z.string() });

const qaSchema = z.object({
  question: z.string(),
  answer: z.union([z.string(), z.number()]).optional(),
  evidence: z.array(z.string()).optional(),
  category: z.number().int(),
});

const itemSchema = z.object({
  sample_id: z.string().optional(),
  conversation: z.record(z.unknown()),
  qa: z.array(qaSchema),
});

export interface LocomoLoadOptions {
  includeAdversarial?: boolean;
}

function sessionNumber(key: string): number {
  return Number(key.slice('session_'.length));
}

function extractSessions(conversation: Record<string, unknown>): EvalSession[] {
  const sessions: EvalSession[] = [];
  for (const [key, value] of Object.entries(conversation)) {
    if (!/^session_\d+$/.test(key) || !Array.isArray(value)) continue;
    const rawDate = conversation[`${key}_date_time`];
    sessions.push({
      id: key,
      occurredAt: parseLocomoDate(typeof rawDate === 'string' ? rawDate : undefined),
      turns: z.array(turnSchema).parse(value),
    });
  }
  return sessions.sort((a, b) => sessionNumber(a.id) - sessionNumber(b.id));
}

function evidenceSessions(evidence: string[] | undefined): string[] {
  const ids = (evidence ?? [])
    .flatMap((ref) => ref.split(/[;,\s]+/))
    .map((ref) => ref.match(/^D(\d+):/i)?.[1])
    .filter((n): n is string => n !== undefined)
    .map((n) => `session_${n}`);
  return [...new Set(ids)];
}

export function loadLocomo(raw: unknown, options: LocomoLoadOptions = {}): EvalConversation[] {
  const items = z.array(itemSchema).parse(raw);
  return items.map((item, index) => {
    const conversationId = item.sample_id ?? `locomo-${index}`;
    const questions: EvalQuestion[] = item.qa
      .filter((qa) => options.includeAdversarial || qa.category !== ADVERSARIAL_CATEGORY)
      .filter((qa) => qa.answer !== undefined)
      .map((qa, qaIndex) => ({
        id: `${conversationId}:q${qaIndex}`,
        question: qa.question,
        answer: String(qa.answer),
        category: CATEGORY_NAMES[qa.category] ?? `category-${qa.category}`,
        evidenceSessionIds: evidenceSessions(qa.evidence),
        askedAt: null,
      }));
    return { id: conversationId, sessions: extractSessions(item.conversation), questions };
  });
}
