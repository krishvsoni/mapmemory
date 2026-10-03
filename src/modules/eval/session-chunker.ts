import type { EvalSession } from './eval.types.js';

export interface SessionChunk {
  sessionId: string;
  occurredAt: Date | null;
  text: string;
}

export const DEFAULT_CHUNK_CHARS = 3000;
const MIN_BUDGET = 200;

function headerFor(session: EvalSession): string {
  if (!session.occurredAt) return '';
  return `[${session.occurredAt.toISOString().slice(0, 16).replace('T', ' ')} UTC]`;
}

export function chunkSession(session: EvalSession, maxChars = DEFAULT_CHUNK_CHARS): SessionChunk[] {
  const header = headerFor(session);
  const budget = Math.max(MIN_BUDGET, maxChars - header.length - 1);
  const chunks: SessionChunk[] = [];
  let lines: string[] = [];
  let used = 0;

  const flush = (): void => {
    if (lines.length === 0) return;
    const body = lines.join('\n');
    chunks.push({
      sessionId: session.id,
      occurredAt: session.occurredAt,
      text: header ? `${header}\n${body}` : body,
    });
    lines = [];
    used = 0;
  };

  for (const turn of session.turns) {
    const line = `${turn.speaker}: ${turn.text}`.slice(0, budget);
    if (used + line.length + 1 > budget) flush();
    lines.push(line);
    used += line.length + 1;
  }
  flush();
  return chunks;
}
