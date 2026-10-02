import type { ChatMessage } from '../../llm/llm.types.js';
import { TRIPLET_CONSTRAINTS } from '../../../config/constants.js';

export function buildTripletExtractionPrompt(observationText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You convert a short piece of text into atomic knowledge triplets.',
        `Each triplet has a subject, relation, and object, each at most ${TRIPLET_CONSTRAINTS.maxWordsPerTriplet} words.`,
        'Decompose compound statements into multiple triplets.',
        'Skip trivial statements that only restate the current location or timestamp.',
        'Respond with JSON only: {"triplets":[{"subject":"...","relation":"...","object":"..."}]}',
      ].join(' '),
    },
    { role: 'user', content: observationText },
  ];
}

export interface ExistingFactForPrompt {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
}

export interface NewTripletForPrompt {
  index: number;
  subject: string;
  relation: string;
  object: string;
}

export function buildContradictionResolutionPrompt(
  existing: ExistingFactForPrompt[],
  incoming: NewTripletForPrompt[],
): ChatMessage[] {
  const existingText = existing
    .map((f) => `[${f.edgeId}] ${f.subject} -- ${f.relation} --> ${f.object}`)
    .join('\n');
  const incomingText = incoming
    .map((t) => `(${t.index}) ${t.subject} -- ${t.relation} --> ${t.object}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        'You compare existing facts about an entity against newly observed facts.',
        'For each new fact that describes the same aspect of the same entity as an existing fact',
        'but updates or contradicts it, mark the existing fact as superseded by the new one.',
        'Leave facts that add distinct information untouched.',
        'Respond with JSON only: {"supersede":[{"existingEdgeId":"...","newTripletIndex":0}]}',
      ].join(' '),
    },
    {
      role: 'user',
      content: `Existing facts:\n${existingText || '(none)'}\n\nNew facts:\n${incomingText}`,
    },
  ];
}
