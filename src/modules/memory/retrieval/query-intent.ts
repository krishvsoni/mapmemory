export type QueryIntent = 'factual' | 'temporal' | 'relational' | 'summary';

export interface RetrievalProfile {
  depth: number;
  width: number;
  episodicTopK: number;
  includeHistory: boolean;
}

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

const RELATIONAL = /\b(related to|relationship|relate|connected|connection|link between|how (?:is|are|do|does|did) .{1,60}? (?:know|know each other|relate|connect))\b|\bbetween .{1,60}? and\b/i;
const TEMPORAL = new RegExp(
  `\\b(when|before|after|since|until|used to|previously|formerly|earlier|history|changed|first time|how long|what date|what year|what month|(?:last|next|this) (?:week|month|year|time|summer|winter)|in (?:19|20)\\d{2}|(?:${MONTHS})\\b)`,
  'i',
);
const SUMMARY = /\b(summar(?:y|ize|ise)|overview|recap|everything (?:about|you know)|tell me about|what do you know about)\b/i;

const PROFILES: Record<QueryIntent, RetrievalProfile> = {
  factual: { depth: 2, width: 5, episodicTopK: 5, includeHistory: false },
  temporal: { depth: 2, width: 8, episodicTopK: 8, includeHistory: true },
  relational: { depth: 3, width: 8, episodicTopK: 5, includeHistory: false },
  summary: { depth: 2, width: 10, episodicTopK: 8, includeHistory: false },
};

export function classifyQueryIntent(query: string): QueryIntent {
  if (RELATIONAL.test(query)) return 'relational';
  if (TEMPORAL.test(query)) return 'temporal';
  if (SUMMARY.test(query)) return 'summary';
  return 'factual';
}

export function profileFor(intent: QueryIntent): RetrievalProfile {
  return PROFILES[intent];
}
