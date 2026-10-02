export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  isRetryable: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts - 1 || !options.isRetryable(error)) throw error;
      const jitter = Math.random() * options.baseDelayMs;
      await sleep(options.baseDelayMs * 2 ** attempt + jitter);
    }
  }
  throw lastError;
}
