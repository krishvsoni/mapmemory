import { describe, expect, it } from 'vitest';
import { edgeStatus, isEdgeVisible, scopeFromAsOf } from './temporal.js';

const day = (n: number): Date => new Date(Date.UTC(2024, 0, n));

const base = { validFrom: null, validTo: null, createdAt: day(10), supersededByEdgeId: null };

describe('isEdgeVisible', () => {
  it('shows only unsuperseded edges in the current scope', () => {
    expect(isEdgeVisible(base, { kind: 'current' })).toBe(true);
    expect(isEdgeVisible({ ...base, supersededByEdgeId: 'x' }, { kind: 'current' })).toBe(false);
  });

  it('falls back to createdAt when validFrom is absent', () => {
    expect(isEdgeVisible(base, { kind: 'asOf', at: day(9) })).toBe(false);
    expect(isEdgeVisible(base, { kind: 'asOf', at: day(11) })).toBe(true);
  });

  it('prefers validFrom over createdAt', () => {
    const edge = { ...base, validFrom: day(2) };
    expect(isEdgeVisible(edge, { kind: 'asOf', at: day(3) })).toBe(true);
  });

  it('treats validTo as an exclusive upper bound', () => {
    const edge = { ...base, validFrom: day(2), validTo: day(5), supersededByEdgeId: 'next' };
    expect(isEdgeVisible(edge, { kind: 'asOf', at: day(4) })).toBe(true);
    expect(isEdgeVisible(edge, { kind: 'asOf', at: day(5) })).toBe(false);
  });

  it('shows everything in the all scope', () => {
    expect(isEdgeVisible({ ...base, supersededByEdgeId: 'x', validTo: day(1) }, { kind: 'all' })).toBe(true);
  });
});

describe('scope helpers', () => {
  it('derives scope from asOf and includeHistory', () => {
    expect(scopeFromAsOf(undefined)).toEqual({ kind: 'current' });
    expect(scopeFromAsOf(undefined, true)).toEqual({ kind: 'all' });
    expect(scopeFromAsOf(day(3), true)).toEqual({ kind: 'asOf', at: day(3) });
  });

  it('labels status from the supersede pointer', () => {
    expect(edgeStatus(base)).toBe('current');
    expect(edgeStatus({ ...base, supersededByEdgeId: 'x' })).toBe('superseded');
  });
});
