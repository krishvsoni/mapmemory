export type EntityType = 'person' | 'location' | 'item' | 'organization' | 'event' | 'concept' | 'other';

export interface SemanticNode {
  id: string;
  spaceId: string;
  label: string;
  normalizedLabel: string;
  entityType: EntityType | null;
  embedding: number[] | null;
}

export interface SemanticEdge {
  id: string;
  spaceId: string;
  sourceNodeId: string;
  relation: string;
  canonicalRelation: string | null;
  targetNodeId: string;
  embedding: number[] | null;
  corroborationCount: number;
  supersededByEdgeId: string | null;
}

export type EpisodeKind = 'raw' | 'reflection';

export interface Episode {
  id: string;
  spaceId: string;
  sequenceNo: number;
  rawText: string;
  kind: EpisodeKind;
  importance: number;
  accessCount: number;
  lastAccessedSequence: number | null;
  embedding: number[] | null;
}

export interface Triplet {
  subject: string;
  relation: string;
  object: string;
  subjectType: EntityType;
  objectType: EntityType;
}

export interface ScoredEdge {
  edge: SemanticEdge;
  score: number;
  depth: number;
}
