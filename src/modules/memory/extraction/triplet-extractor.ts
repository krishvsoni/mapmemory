import { z } from 'zod';
import type { LlmService } from '../../llm/llm.service.js';
import { env } from '../../../config/env.js';
import { buildTripletExtractionPrompt } from './extraction.prompts.js';
import type { Triplet } from '../../graph/graph.types.js';

const entityTypeSchema = z.enum(['person', 'location', 'item', 'organization', 'event', 'concept', 'other']);

const extractionSchema = z.object({
  importance: z.number().int().min(1).max(10),
  triplets: z.array(
    z.object({
      subject: z.string().min(1),
      relation: z.string().min(1),
      object: z.string().min(1),
      subjectType: entityTypeSchema,
      objectType: entityTypeSchema,
    }),
  ),
});

export interface ExtractionResult {
  importance: number;
  triplets: Triplet[];
}

export class TripletExtractor {
  constructor(private readonly llm: LlmService) {}

  async extract(observationText: string): Promise<ExtractionResult> {
    const messages = buildTripletExtractionPrompt(observationText);
    const result = await this.llm.completeJson(messages, extractionSchema);

    if (result.triplets.length === 0 && env.OPENROUTER_ESCALATION_CHAT_MODEL) {
      const escalated = await this.llm.completeJson(messages, extractionSchema, 1, env.OPENROUTER_ESCALATION_CHAT_MODEL);
      return escalated;
    }

    return result;
  }
}
