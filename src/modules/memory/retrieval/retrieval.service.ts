import { PriorityQueue } from '../../../shared/utils/priority-queue.js';
import { RETRIEVAL_DEFAULTS } from '../../../config/constants.js';
import type { GraphService } from '../../graph/graph.service.js';
import type { TraversalService, BeamSearchOptions } from '../../graph/traversal.service.js';
import type { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import type { LlmService } from '../../llm/llm.service.js';
import type { Episode, ScoredEdge } from '../../graph/graph.types.js';
import { compositeEpisodicScore, episodicRelevance } from './episodic-scoring.js';

export interface RetrievalResult {
  facts: ScoredEdge[];
  episodes: Array<{ episode: Episode; relevance: number }>;
}

export class RetrievalService {
  constructor(
    private readonly graph: GraphService,
    private readonly traversal: TraversalService,
    private readonly episodes: EpisodeRepository,
    private readonly llm: LlmService,
  ) {}

  async retrieve(spaceId: string, queryText: string, options: BeamSearchOptions = {}): Promise<RetrievalResult> {
    const queryEmbedding = await this.llm.embedOne(queryText);
    const facts = await this.traversal.beamSearch(spaceId, queryEmbedding, options);
    const episodeResults = await this.rankEpisodes(spaceId, facts);
    return { facts, episodes: episodeResults };
  }

  private async rankEpisodes(
    spaceId: string,
    facts: ScoredEdge[],
  ): Promise<Array<{ episode: Episode; relevance: number }>> {
    if (facts.length === 0) return [];

    const edgeIds = facts.map((f) => f.edge.id);
    const episodeIdsByEdge = await this.episodes.episodesByEdgeIds(edgeIds);
    const episodeIds = [...new Set([...episodeIdsByEdge.values()].flat())];
    if (episodeIds.length === 0) return [];

    const [totalCountByEpisode, episodeRows, latestSequenceNo] = await Promise.all([
      this.episodes.edgeCountByEpisode(episodeIds),
      this.episodes.byIds(episodeIds),
      this.episodes.latestSequenceNo(spaceId),
    ]);
    const episodeById = new Map(episodeRows.map((e) => [e.id, e]));

    const overlapCountByEpisode = new Map<string, number>();
    for (const edgeId of edgeIds) {
      const linkedEpisodes = episodeIdsByEdge.get(edgeId) ?? [];
      for (const episodeId of linkedEpisodes) {
        overlapCountByEpisode.set(episodeId, (overlapCountByEpisode.get(episodeId) ?? 0) + 1);
      }
    }

    const queue = new PriorityQueue<{ episodeId: string; relevance: number }>();
    for (const episodeId of episodeIds) {
      const episode = episodeById.get(episodeId);
      const baseRelevance = episodicRelevance(
        overlapCountByEpisode.get(episodeId) ?? 0,
        totalCountByEpisode.get(episodeId) ?? 0,
      );
      const score = compositeEpisodicScore({
        relevance: baseRelevance,
        importance: episode?.importance ?? 5,
        ageInSteps: latestSequenceNo - (episode?.sequenceNo ?? latestSequenceNo),
        halfLifeSteps: RETRIEVAL_DEFAULTS.recencyHalfLifeSteps,
        accessCount: episode?.accessCount ?? 0,
      });
      queue.push({ episodeId, relevance: score }, score);
    }

    const top = queue.topK(RETRIEVAL_DEFAULTS.episodicTopK);
    await this.episodes.recordAccess(
      top.map((t) => t.episodeId),
      latestSequenceNo,
    );

    return top
      .map((t) => {
        const episode = episodeById.get(t.episodeId);
        return episode ? { episode, relevance: t.relevance } : null;
      })
      .filter((v): v is { episode: Episode; relevance: number } => v !== null);
  }
}
