import { env } from '../../config/env.js';
import { OpenAiCompatibleProvider } from './openai-compatible.provider.js';
import type { LlmProvider } from './llm.types.js';

export function createLlmProvider(): LlmProvider {
  if (env.LLM_PROVIDER === 'openai') {
    return new OpenAiCompatibleProvider({
      name: 'openai',
      apiKey: env.OPENAI_API_KEY ?? '',
      baseUrl: env.OPENAI_BASE_URL,
      chatModel: env.OPENAI_CHAT_MODEL,
      embeddingModel: env.OPENAI_EMBED_MODEL,
    });
  }
  return new OpenAiCompatibleProvider({
    name: 'openrouter',
    apiKey: env.OPENROUTER_API_KEY ?? '',
    baseUrl: env.OPENROUTER_BASE_URL,
    chatModel: env.OPENROUTER_CHAT_MODEL,
    embeddingModel: env.OPENROUTER_EMBED_MODEL,
  });
}

export function escalationChatModel(): string | undefined {
  const model = env.LLM_PROVIDER === 'openai' ? env.OPENAI_ESCALATION_CHAT_MODEL : env.OPENROUTER_ESCALATION_CHAT_MODEL;
  return model || undefined;
}
