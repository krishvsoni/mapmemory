import type { McpFact, RecallResponse } from './api-client.js';

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '?';
}

export function formatFact(fact: McpFact): string {
  const window =
    fact.status === 'superseded'
      ? `superseded, was true ${day(fact.validFrom)} to ${day(fact.validTo)}`
      : `current, since ${day(fact.validFrom)}`;
  return `- ${fact.subject} ${fact.relation} ${fact.object} [${window}; confidence ${fact.confidence.toFixed(2)}; id ${fact.edgeId}]`;
}

export function formatRecall(response: RecallResponse): string {
  if (response.facts.length === 0 && response.episodes.length === 0) return 'No relevant memories found.';

  const sections: string[] = [];
  if (response.facts.length > 0) sections.push(`Facts:\n${response.facts.map(formatFact).join('\n')}`);
  if (response.episodes.length > 0) {
    const passages = response.episodes.map((e) => `[${day(e.occurredAt)}${e.kind === 'reflection' ? ', summary' : ''}] ${e.text}`);
    sections.push(`Source passages:\n${passages.join('\n\n')}`);
  }
  return sections.join('\n\n');
}

export function formatHistory(history: McpFact[]): string {
  if (history.length === 0) return 'No history found for that fact.';
  return history.map(formatFact).join('\n');
}
