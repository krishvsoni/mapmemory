import type { ChatMessage } from '../../llm/llm.types.js';

export function buildReflectionPrompt(episodeTexts: string[]): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You synthesize a batch of raw memory entries from an agent into one higher-level insight.',
        'Write 1-3 sentences capturing the durable pattern, preference, or conclusion that generalizes',
        'across them. Do not just restate or list the individual entries.',
        'Respond with plain text only, no JSON, no preamble.',
      ].join(' '),
    },
    {
      role: 'user',
      content: episodeTexts.map((text, i) => `${i + 1}. ${text}`).join('\n'),
    },
  ];
}
