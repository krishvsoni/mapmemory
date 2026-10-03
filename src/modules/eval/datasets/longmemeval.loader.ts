import { z } from 'zod';
import type { EvalConversation, EvalSession } from '../eval.types.js';
import { parseLongMemEvalDate } from './date-parsing.js';

const itemSchema = z.object({
  question_id: z.string(),
  question_type: z.string(),
  question: z.string(),
  answer: z.union([z.string(), z.number()]),
  question_date: z.string().optional(),
  haystack_session_ids: z.array(z.string()),
  haystack_dates: z.array(z.string()).optional(),
  haystack_sessions: z.array(z.array(z.object({ role: z.string(), content: z.string() }))),
  answer_session_ids: z.array(z.string()).optional(),
});

export function loadLongMemEval(raw: unknown): EvalConversation[] {
  return z.array(itemSchema).parse(raw).map((item) => {
    const sessions: EvalSession[] = item.haystack_sessions.map((turns, index) => ({
      id: item.haystack_session_ids[index] ?? `session_${index}`,
      occurredAt: parseLongMemEvalDate(item.haystack_dates?.[index]),
      turns: turns.map((turn) => ({ speaker: turn.role, text: turn.content })),
    }));
    sessions.sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0));

    const isAbstention = item.question_id.endsWith('_abs');
    return {
      id: item.question_id,
      sessions,
      questions: [
        {
          id: item.question_id,
          question: item.question,
          answer: String(item.answer),
          category: isAbstention ? `${item.question_type} (abstention)` : item.question_type,
          evidenceSessionIds: item.answer_session_ids ?? [],
          askedAt: parseLongMemEvalDate(item.question_date),
        },
      ],
    };
  });
}
