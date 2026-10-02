import type { Database } from '../../../db/client.js';
import { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import type { LlmService } from '../../llm/llm.service.js';
import { REFLECTION_DEFAULTS } from '../../../config/constants.js';
import type { Episode } from '../../graph/graph.types.js';
import { buildReflectionPrompt } from './reflection.prompts.js';

function average(values: number[]): number {
  if (values.length === 0) return REFLECTION_DEFAULTS.defaultImportance;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export class ReflectionService {
  private readonly episodes: EpisodeRepository;

  constructor(
    private readonly db: Database,
    private readonly llm: LlmService,
  ) {
    this.episodes = new EpisodeRepository(db);
  }

  async reflect(spaceId: string): Promise<Episode | null> {
    const candidates = await this.episodes.unreflectedRawEpisodes(spaceId, REFLECTION_DEFAULTS.clusterSize);
    if (candidates.length < REFLECTION_DEFAULTS.minClusterSize) return null;

    const summaryText = await this.llm.chat(buildReflectionPrompt(candidates.map((c) => c.rawText)), 0.3);
    const embedding = await this.llm.embedOne(summaryText);
    const importance = Math.max(
      Math.round(average(candidates.map((c) => c.importance))),
      REFLECTION_DEFAULTS.defaultImportance,
    );

    return this.db.transaction(async (tx) => {
      const episodesTx = new EpisodeRepository(tx);
      return episodesTx.createReflection(
        spaceId,
        summaryText,
        embedding,
        importance,
        candidates.map((c) => c.id),
      );
    });
  }

  async sweepAllSpaces(): Promise<Array<{ spaceId: string; reflection: Episode | null }>> {
    const spaceIds = await this.episodes.spacesNeedingReflection(REFLECTION_DEFAULTS.minClusterSize);
    const results: Array<{ spaceId: string; reflection: Episode | null }> = [];
    for (const spaceId of spaceIds) {
      results.push({ spaceId, reflection: await this.reflect(spaceId) });
    }
    return results;
  }
}
