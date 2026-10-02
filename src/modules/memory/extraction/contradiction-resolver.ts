import { z } from 'zod';
import type { LlmService } from '../../llm/llm.service.js';
import {
  buildContradictionResolutionPrompt,
  type ExistingFactForPrompt,
  type NewTripletForPrompt,
} from './extraction.prompts.js';

const supersedeSchema = z.object({
  supersede: z.array(
    z.object({
      existingEdgeId: z.string(),
      newTripletIndex: z.number().int().nonnegative(),
    }),
  ),
});

export interface SupersedePair {
  existingEdgeId: string;
  newTripletIndex: number;
}

export class ContradictionResolver {
  constructor(private readonly llm: LlmService) {}

  async resolve(existing: ExistingFactForPrompt[], incoming: NewTripletForPrompt[]): Promise<SupersedePair[]> {
    if (existing.length === 0 || incoming.length === 0) return [];
    const messages = buildContradictionResolutionPrompt(existing, incoming);
    const result = await this.llm.completeJson(messages, supersedeSchema);
    return result.supersede;
  }
}
