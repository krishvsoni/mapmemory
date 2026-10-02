import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { LruCache } from '../../shared/utils/lru-cache.js';
import { CACHE_DEFAULTS } from '../../config/constants.js';
import { AppError } from '../../shared/errors.js';
import { getRedisConnection } from '../queue/redis-connection.js';
import { OpenRouterProvider } from './openrouter.provider.js';
import type { ChatMessage, LlmProvider } from './llm.types.js';

function cacheKey(provider: LlmProvider, text: string): string {
  const hash = createHash('sha256').update(text).digest('hex');
  return `embcache:v1:${provider.name}:${provider.embeddingModelId}:${hash}`;
}

export class LlmService {
  private readonly localCache = new LruCache<string, number[]>(CACHE_DEFAULTS.embeddingCacheSize);

  constructor(private readonly provider: LlmProvider = new OpenRouterProvider()) {}

  async chat(messages: ChatMessage[], temperature = 0.2): Promise<string> {
    return this.provider.complete(messages, { temperature });
  }

  async embedOne(text: string): Promise<number[]> {
    const [embedding] = await this.embedMany([text]);
    if (!embedding) throw new AppError('EMBEDDING_FAILED', 'Failed to produce embedding', 502);
    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const results = new Array<number[] | undefined>(texts.length);
    const keys = texts.map((text) => cacheKey(this.provider, text));

    const remoteMisses: { index: number; text: string }[] = [];
    await Promise.all(
      texts.map(async (text, index) => {
        const local = this.localCache.get(keys[index] as string);
        if (local) {
          results[index] = local;
          return;
        }
        const remote = await this.readFromRedis(keys[index] as string);
        if (remote) {
          this.localCache.set(keys[index] as string, remote);
          results[index] = remote;
          return;
        }
        remoteMisses.push({ index, text });
      }),
    );

    if (remoteMisses.length > 0) {
      const fresh = await this.provider.embed(remoteMisses.map((m) => m.text));
      await Promise.all(
        fresh.map(async (embedding, i) => {
          const miss = remoteMisses[i];
          if (!miss) return;
          const key = keys[miss.index] as string;
          this.localCache.set(key, embedding);
          await this.writeToRedis(key, embedding);
          results[miss.index] = embedding;
        }),
      );
    }

    return results.map((r) => {
      if (!r) throw new AppError('EMBEDDING_FAILED', 'Failed to produce embedding', 502);
      return r;
    });
  }

  async completeJson<T>(messages: ChatMessage[], schema: z.ZodType<T>, retries = 1): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const raw = await this.chat(messages, 0);
      try {
        const parsed = JSON.parse(extractJsonBlock(raw)) as unknown;
        return schema.parse(parsed);
      } catch (error) {
        lastError = error;
      }
    }
    throw new AppError('LLM_JSON_PARSE_FAILED', `Could not parse structured output: ${String(lastError)}`, 502);
  }

  private async readFromRedis(key: string): Promise<number[] | undefined> {
    try {
      const raw = await getRedisConnection().get(key);
      return raw ? (JSON.parse(raw) as number[]) : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeToRedis(key: string, embedding: number[]): Promise<void> {
    try {
      await getRedisConnection().set(key, JSON.stringify(embedding), 'EX', CACHE_DEFAULTS.embeddingCacheTtlSeconds);
    } catch {
      // cache is a best-effort accelerator; a write failure must not fail ingestion
    }
  }
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}
