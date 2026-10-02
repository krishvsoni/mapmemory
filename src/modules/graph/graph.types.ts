export interface SemanticNode {
  id: string;
  spaceId: string;
  label: string;
  normalizedLabel: string;
  embedding: number[] | null;
}

export interface SemanticEdge {
  id: string;
  spaceId: string;
  sourceNodeId: string;
  relation: string;
  targetNodeId: string;
  embedding: number[] | null;
  supersededByEdgeId: string | null;
}

export interface Episode {
  id: string;
  spaceId: string;
  sequenceNo: number;
  rawText: string;
  embedding: number[] | null;
}

export interface Triplet {
  subject: string;
  relation: string;
  object: string;
}

export interface ScoredEdge {
  edge: SemanticEdge;
  score: number;
  depth: number;
}
