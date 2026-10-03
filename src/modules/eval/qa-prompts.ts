import type { ChatMessage } from '../llm/llm.types.js';

export interface ContextFact {
  subject: string;
  relation: string;
  object: string;
  validFrom: Date | null;
  validTo: Date | null;
  status: 'current' | 'superseded';
}

export interface ContextEpisode {
  text: string;
}

function day(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '?';
}

function validityNote(fact: ContextFact): string {
  if (fact.status === 'superseded') {
    return ` (true ${day(fact.validFrom)} to ${day(fact.validTo)}, no longer current)`;
  }
  return fact.validFrom ? ` (since ${day(fact.validFrom)})` : '';
}

export function formatContext(facts: ContextFact[], episodes: ContextEpisode[]): string {
  const factLines = facts.map((f) => `- ${f.subject} ${f.relation} ${f.object}${validityNote(f)}`);
  const episodeLines = episodes.map((e, i) => `[${i + 1}] ${e.text}`);
  return [
    'Facts:',
    factLines.join('\n') || '(none)',
    '',
    'Source passages:',
    episodeLines.join('\n\n') || '(none)',
  ].join('\n');
}

export function buildAnswerPrompt(question: string, context: string, askedAt: Date | null): ChatMessage[] {
  const today = askedAt ? `Today is ${day(askedAt)}.` : '';
  const instructions = [
    'Answer the question using only the memory context below.',
    today,
    'Give a short, direct answer. Resolve relative dates against the dates in the passages.',
    "If the context does not contain the answer, reply exactly: I don't know.",
  ];
  return [
    { role: 'system', content: instructions.filter(Boolean).join(' ') },
    { role: 'user', content: `${context}\n\nQuestion: ${question}` },
  ];
}

export function buildJudgePrompt(question: string, gold: string, predicted: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You grade an answer against a reference answer.',
        'The answer is correct if it contains the same key information as the reference, even if worded differently or more verbosely.',
        'Dates are correct if they refer to the same day, month or period the reference gives.',
        'An answer that says it does not know is incorrect unless the reference says the information is unavailable.',
        'Respond with JSON only: {"correct":true} or {"correct":false}',
      ].join(' '),
    },
    { role: 'user', content: `Question: ${question}\nReference answer: ${gold}\nAnswer to grade: ${predicted}` },
  ];
}
