import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('stays closed while calls succeed', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.currentState).toBe('closed');
  });

  it('opens after the failure threshold and fails fast without calling fn', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 10_000 });
    const failing = vi.fn(() => Promise.reject(new Error('boom')));

    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    expect(breaker.currentState).toBe('open');

    await expect(breaker.execute(failing)).rejects.toThrow('LLM provider is failing repeatedly');
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('half-opens after cooldown and closes again on success', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    expect(breaker.currentState).toBe('open');

    await new Promise((resolve) => setTimeout(resolve, 5));
    await breaker.execute(() => Promise.resolve('recovered'));
    expect(breaker.currentState).toBe('closed');
  });
});
