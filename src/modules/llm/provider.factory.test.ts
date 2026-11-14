import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  DATABASE_URL: 'postgres://x',
  REDIS_URL: 'redis://x',
  AUTH_JWT_SECRET: 'a'.repeat(16),
  API_KEY_PEPPER: 'b'.repeat(16),
  INTERNAL_INTEGRATION_SECRET: 'c'.repeat(16),
};

async function loadWith(overrides: Record<string, string>) {
  vi.resetModules();
  vi.doMock('dotenv/config', () => ({}));
  const saved = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (/^(OPENAI|OPENROUTER|LLM_PROVIDER)/.test(key)) delete process.env[key];
  }
  Object.assign(process.env, baseEnv, overrides);
  try {
    return await import('./provider.factory.js');
  } finally {
    process.env = saved;
  }
}

afterEach(() => vi.doUnmock('dotenv/config'));

describe('provider factory', () => {
  it('builds an OpenAI provider when LLM_PROVIDER=openai', async () => {
    const { createLlmProvider } = await loadWith({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' });
    const provider = createLlmProvider();
    expect(provider.name).toBe('openai');
    expect(provider.embeddingModelId).toBe('text-embedding-3-small');
  });

  it('defaults to OpenRouter', async () => {
    const { createLlmProvider } = await loadWith({ OPENROUTER_API_KEY: 'or-x', OPENAI_API_KEY: '' });
    expect(createLlmProvider().name).toBe('openrouter');
  });

  it('rejects a selected provider with no key', async () => {
    await expect(loadWith({ LLM_PROVIDER: 'openai' })).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('resolves the escalation model for the active provider', async () => {
    const { escalationChatModel } = await loadWith({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-x',
      OPENAI_ESCALATION_CHAT_MODEL: 'gpt-4o',
    });
    expect(escalationChatModel()).toBe('gpt-4o');
  });
});
