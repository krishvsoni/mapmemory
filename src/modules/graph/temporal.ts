import type { SemanticEdge } from './graph.types.js';

export type FactScope = { kind: 'current' } | { kind: 'asOf'; at: Date } | { kind: 'all' };

export type FactStatus = 'current' | 'superseded';

export const CURRENT_SCOPE: FactScope = { kind: 'current' };

type TemporalFields = Pick<SemanticEdge, 'validFrom' | 'validTo' | 'createdAt' | 'supersededByEdgeId'>;

export function effectiveStart(edge: TemporalFields): Date {
  return edge.validFrom ?? edge.createdAt;
}

export function edgeStatus(edge: TemporalFields): FactStatus {
  return edge.supersededByEdgeId === null ? 'current' : 'superseded';
}

export function isEdgeVisible(edge: TemporalFields, scope: FactScope): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'current') return edge.supersededByEdgeId === null;
  const at = scope.at.getTime();
  if (effectiveStart(edge).getTime() > at) return false;
  return edge.validTo === null || edge.validTo.getTime() > at;
}

export function scopeFromAsOf(asOf: Date | undefined, includeHistory = false): FactScope {
  if (asOf) return { kind: 'asOf', at: asOf };
  return includeHistory ? { kind: 'all' } : CURRENT_SCOPE;
}
