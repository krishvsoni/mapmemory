import type { ChatCompletionOptions, ChatMessage, LlmProvider } from '../../modules/llm/llm.types.js';

function hashWord(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i += 1) {
    hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function deterministicEmbedding(text: string, dimensions: number): number[] {
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    vector[hashWord(word) % dimensions] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export class ScriptedLlmProvider implements LlmProvider {
  readonly name = 'scripted-fake';
  readonly embeddingModelId = 'bag-of-words-fake-v1';

  private readonly queue: string[] = [];

  constructor(private readonly embeddingDimensions: number) {}

  enqueue(response: string): void {
    this.queue.push(response);
  }

  async complete(_messages: ChatMessage[], _options?: ChatCompletionOptions): Promise<string> {
    const next = this.queue.shift();
    if (next === undefined) throw new Error('ScriptedLlmProvider: no scripted response queued');
    return next;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => deterministicEmbedding(text, this.embeddingDimensions));
  }
}
