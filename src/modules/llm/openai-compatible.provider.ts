import { AppError } from '../../shared/errors.js';
import { withRetry } from './retry.js';
import type { ChatCompletionOptions, ChatMessage, LlmProvider } from './llm.types.js';

export interface OpenAiCompatibleConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableHttpError) return true;
  return error instanceof TypeError;
}

class RetryableHttpError extends Error {}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  readonly embeddingModelId: string;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.name;
    this.embeddingModelId = config.embeddingModel;
  }

  async complete(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    try {
      return await withRetry(() => this.completeOnce(messages, options), this.retryOptions());
    } catch (error) {
      throw this.toAppError(error, 'LLM_REQUEST_FAILED');
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      return await withRetry(() => this.embedOnce(texts), this.retryOptions());
    } catch (error) {
      throw this.toAppError(error, 'EMBEDDING_REQUEST_FAILED');
    }
  }

  private toAppError(error: unknown, code: string): Error {
    if (error instanceof RetryableHttpError) return new AppError(code, error.message, 502);
    return error instanceof Error ? error : new Error(String(error));
  }

  private async completeOnce(messages: ChatMessage[], options: ChatCompletionOptions): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: options.model ?? this.config.chatModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      await this.raiseForStatus(response, 'LLM_REQUEST_FAILED');
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices[0]?.message.content;
    if (!content) {
      throw new AppError('LLM_EMPTY_RESPONSE', 'Chat completion returned no content', 502);
    }
    return content;
  }

  private async embedOnce(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.embeddingModelId, input: texts }),
    });

    if (!response.ok) {
      await this.raiseForStatus(response, 'EMBEDDING_REQUEST_FAILED');
    }

    const payload = (await response.json()) as EmbeddingResponse;
    return payload.data.map((item) => item.embedding);
  }

  private retryOptions() {
    return { attempts: 3, baseDelayMs: 300, isRetryable: isRetryableError };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async raiseForStatus(response: Response, code: string): Promise<never> {
    const body = await response.text().catch(() => '');
    const message = `${response.status} ${response.statusText}: ${body}`;
    if (RETRYABLE_STATUS_CODES.has(response.status)) {
      throw new RetryableHttpError(message);
    }
    throw new AppError(code, message, 502);
  }
}
