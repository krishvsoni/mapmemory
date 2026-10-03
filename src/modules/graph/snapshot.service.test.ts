import { describe, expect, it } from 'vitest';
import { strongestEdges } from './snapshot.service.js';
import type { SemanticEdge } from './graph.types.js';

function edge(id: string, corroborationCount: number): SemanticEdge {
  return {
    id,
    spaceId: 's',
    sourceNodeId: 'a',
    relation: 'r',
    canonicalRelation: 'r',
    targetNodeId: 'b',
    embedding: null,
    corroborationCount,
    supersededByEdgeId: null,
    validFrom: null,
    validTo: null,
    createdAt: new Date(),
  };
}

describe('strongestEdges', () => {
  it('keeps the most corroborated edges first and respects the limit', () => {
    const result = strongestEdges([edge('a', 1), edge('b', 5), edge('c', 3)], 2);
    expect(result.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [edge('a', 1), edge('b', 2)];
    strongestEdges(input, 1);
    expect(input.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
