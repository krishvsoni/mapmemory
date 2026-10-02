import { z } from 'zod';
import type { LlmService } from '../../llm/llm.service.js';
import { buildTripletExtractionPrompt } from './extraction.prompts.js';
import type { Triplet } from '../../graph/graph.types.js';

const tripletSchema = z.object({
  triplets: z.array(
    z.object({
      subject: z.string().min(1),
      relation: z.string().min(1),
      object: z.string().min(1),
    }),
  ),
});

export class TripletExtractor {
  constructor(private readonly llm: LlmService) {}

  async extract(observationText: string): Promise<Triplet[]> {
    const messages = buildTripletExtractionPrompt(observationText);
    const result = await this.llm.completeJson(messages, tripletSchema);
    return result.triplets;
  }
}
