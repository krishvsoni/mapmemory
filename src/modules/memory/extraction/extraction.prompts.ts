import type { ChatMessage } from '../../llm/llm.types.js';
import { TRIPLET_CONSTRAINTS } from '../../../config/constants.js';

const ENTITY_TYPES = ['person', 'location', 'item', 'organization', 'event', 'concept', 'other'];

export function buildTripletExtractionPrompt(observationText: string, referenceTime?: Date): ChatMessage[] {
  const referenceLine = referenceTime
    ? `The text was written on ${referenceTime.toISOString().slice(0, 10)}; resolve relative dates such as "yesterday" or "last year" against that day.`
    : 'No reference date is known; only fill validFrom when the text states an explicit date.';
  return [
    {
      role: 'system',
      content: [
        'You convert a short piece of text into atomic knowledge triplets and rate its significance.',
        `Each triplet has a subject, relation, and object, each at most ${TRIPLET_CONSTRAINTS.maxWordsPerTriplet} words.`,
        `Tag each subject and object with one type from: ${ENTITY_TYPES.join(', ')}.`,
        'Decompose compound statements into multiple triplets.',
        'Skip trivial statements that only restate the current location or timestamp.',
        referenceLine,
        'For each triplet set validFrom to the ISO date (YYYY-MM-DD) on which that fact began to hold when the text says so, otherwise null.',
        'Also rate how significant, novel, or decision-relevant this text is for an agent to remember later,',
        'as an integer importance from 1 (trivial, forgettable) to 10 (pivotal, must remember).',
        'Respond with JSON only: {"importance":5,"triplets":[{"subject":"...","relation":"...","object":"...",',
        '"subjectType":"...","objectType":"...","validFrom":null}]}',
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
