export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatProvider {
  complete(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface LlmProvider extends ChatProvider, EmbeddingProvider {
  readonly name: string;
  readonly embeddingModelId: string;
}
