import { describe, expect, it } from 'vitest';
import { resolvePlanLimit } from './usage.service.js';

describe('resolvePlanLimit', () => {
  it('returns the free plan limits for an unknown or missing plan', () => {
    expect(resolvePlanLimit('nonexistent-plan')).toEqual(resolvePlanLimit('free'));
  });

  it('gives enterprise unlimited spaces and episodes', () => {
    const limit = resolvePlanLimit('enterprise');
    expect(Number.isFinite(limit.maxSpaces)).toBe(false);
    expect(Number.isFinite(limit.maxEpisodesPerMonth)).toBe(false);
  });

  it('gives pro a higher ceiling than free', () => {
    expect(resolvePlanLimit('pro').maxSpaces).toBeGreaterThan(resolvePlanLimit('free').maxSpaces);
    expect(resolvePlanLimit('pro').maxEpisodesPerMonth).toBeGreaterThan(resolvePlanLimit('free').maxEpisodesPerMonth);
  });
});
