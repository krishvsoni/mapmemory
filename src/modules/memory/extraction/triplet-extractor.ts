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
      validFrom: z.string().nullish(),
    }),
  ),
});

export interface ExtractionResult {
  importance: number;
  triplets: Triplet[];
}

function parseValidFrom(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTriplets(parsed: z.infer<typeof extractionSchema>): ExtractionResult {
  return {
    importance: parsed.importance,
    triplets: parsed.triplets.map((t) => ({ ...t, validFrom: parseValidFrom(t.validFrom) })),
  };
}

export class TripletExtractor {
  constructor(private readonly llm: LlmService) {}

  async extract(observationText: string, referenceTime?: Date): Promise<ExtractionResult> {
    const messages = buildTripletExtractionPrompt(observationText, referenceTime);
    const result = await this.llm.completeJson(messages, extractionSchema);

    if (result.triplets.length === 0 && env.OPENROUTER_ESCALATION_CHAT_MODEL) {
      const escalated = await this.llm.completeJson(messages, extractionSchema, 1, env.OPENROUTER_ESCALATION_CHAT_MODEL);
      return toTriplets(escalated);
    }

    return toTriplets(result);
  }
}
