import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from './openai-compatible.provider.js';

const config = {
  name: 'openai',
  apiKey: 'sk-test',
  baseUrl: 'https://api.example.test/v1',
  chatModel: 'chat-model',
  embeddingModel: 'embed-model',
};

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', ...response });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleProvider', () => {
  it('exposes the configured identity', () => {
    const provider = new OpenAiCompatibleProvider(config);
    expect(provider.name).toBe('openai');
    expect(provider.embeddingModelId).toBe('embed-model');
  });

  it('sends chat requests with bearer auth and the configured model', async () => {
    const fetchMock = mockFetch({ json: async () => ({ choices: [{ message: { content: 'hello' } }] }) });
    const result = await new OpenAiCompatibleProvider(config).complete([{ role: 'user', content: 'hi' }]);

    expect(result).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string).model).toBe('chat-model');
  });

  it('honours a per-call model override', async () => {
    const fetchMock = mockFetch({ json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    await new OpenAiCompatibleProvider(config).complete([{ role: 'user', content: 'hi' }], { model: 'bigger' });
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string).model).toBe('bigger');
  });

  it('returns embeddings in input order', async () => {
    const fetchMock = mockFetch({ json: async () => ({ data: [{ embedding: [1, 2] }, { embedding: [3, 4] }] }) });
    const result = await new OpenAiCompatibleProvider(config).embed(['a', 'b']);

    expect(result).toEqual([[1, 2], [3, 4]]);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.test/v1/embeddings');
  });

  it('skips the network for empty embedding input', async () => {
    const fetchMock = mockFetch({});
    expect(await new OpenAiCompatibleProvider(config).embed([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails fast on non-retryable errors', async () => {
    const fetchMock = mockFetch({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad key' });
    await expect(new OpenAiCompatibleProvider(config).complete([{ role: 'user', content: 'x' }])).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
