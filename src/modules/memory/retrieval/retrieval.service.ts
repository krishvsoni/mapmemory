import { PriorityQueue } from '../../../shared/utils/priority-queue.js';
import { cosineSimilarity } from '../../../shared/utils/vector-math.js';
import { RETRIEVAL_DEFAULTS } from '../../../config/constants.js';
import type { GraphService } from '../../graph/graph.service.js';
import type { TraversalService } from '../../graph/traversal.service.js';
import type { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import type { LlmService } from '../../llm/llm.service.js';
import type { Episode, ScoredEdge } from '../../graph/graph.types.js';
import { scopeFromAsOf } from '../../graph/temporal.js';
import { compositeEpisodicScore, episodicRelevance } from './episodic-scoring.js';
import { gatherEpisodeCandidates } from './episode-candidates.js';
import { classifyQueryIntent, profileFor, type QueryIntent } from './query-intent.js';

export interface RetrieveOptions {
  depth?: number;
  width?: number;
  minSimilarity?: number;
  asOf?: Date;
  hybrid?: boolean;
  includeHistory?: boolean;
  episodicTopK?: number;
  reinforce?: boolean;
}

export interface RankedEpisode {
  episode: Episode;
  relevance: number;
}

export interface RetrievalResult {
  intent: QueryIntent;
  facts: ScoredEdge[];
  episodes: RankedEpisode[];
}

function happenedAfter(episode: Episode, asOf: Date | undefined): boolean {
  if (!asOf) return false;
  return (episode.occurredAt ?? episode.createdAt).getTime() > asOf.getTime();
}

export class RetrievalService {
  constructor(
    private readonly graph: GraphService,
    private readonly traversal: TraversalService,
    private readonly episodes: EpisodeRepository,
    private readonly llm: LlmService,
    private readonly writeEpisodes: EpisodeRepository = episodes,
  ) {}

  async retrieve(spaceId: string, queryText: string, options: RetrieveOptions = {}): Promise<RetrievalResult> {
    const intent = classifyQueryIntent(queryText);
    const profile = profileFor(intent);
    const hybrid = options.hybrid ?? true;
    const scope = scopeFromAsOf(options.asOf, options.includeHistory ?? profile.includeHistory);

    const queryEmbedding = await this.llm.embedOne(queryText);
    const facts = await this.traversal.beamSearch(spaceId, queryEmbedding, {
      depth: options.depth ?? profile.depth,
      width: options.width ?? profile.width,
      minSimilarity: options.minSimilarity,
      queryText: hybrid ? queryText : undefined,
      scope,
    });
    const episodes = await this.rankEpisodes(spaceId, facts, queryEmbedding, queryText, {
      hybrid,
      asOf: options.asOf,
      topK: options.episodicTopK ?? profile.episodicTopK,
      reinforce: options.reinforce ?? true,
    });
    return { intent, facts, episodes };
  }

  private async rankEpisodes(
    spaceId: string,
    facts: ScoredEdge[],
    queryEmbedding: number[],
    queryText: string,
    settings: { hybrid: boolean; asOf?: Date; topK: number; reinforce: boolean },
  ): Promise<RankedEpisode[]> {
    const edgeIds = facts.map((f) => f.edge.id);
    const retrievedEdgesByEpisode = await this.episodes.linkedEdgesByEpisode(edgeIds);
    const linkedIds = [...retrievedEdgesByEpisode.keys()];

    const { episodeById, lexicalSignalById } = await gatherEpisodeCandidates(
      this.episodes,
      spaceId,
      queryEmbedding,
      queryText,
      linkedIds,
      settings.hybrid,
    );
    const candidateIds = [...episodeById.keys()].filter((id) => !happenedAfter(episodeById.get(id) as Episode, settings.asOf));
    if (candidateIds.length === 0) return [];

    const [totalCountByEpisode, latestSequenceNo] = await Promise.all([
      this.episodes.edgeCountByEpisode(candidateIds),
      this.episodes.latestSequenceNo(spaceId),
    ]);

    const queue = new PriorityQueue<RankedEpisode>();
    for (const episodeId of candidateIds) {
      const episode = episodeById.get(episodeId) as Episode;
      const relevance = compositeEpisodicScore({
        relevance: episodicRelevance(retrievedEdgesByEpisode.get(episodeId)?.length ?? 0, totalCountByEpisode.get(episodeId) ?? 0),
        querySimilarity: episode.embedding ? cosineSimilarity(queryEmbedding, episode.embedding) : 0,
        importance: episode.importance,
        ageInSteps: latestSequenceNo - episode.sequenceNo,
        halfLifeSteps: RETRIEVAL_DEFAULTS.recencyHalfLifeSteps,
        accessCount: episode.accessCount,
        lexicalSignal: lexicalSignalById.get(episodeId),
      });
      queue.push({ episode, relevance }, relevance);
    }

    const top = queue.topK(settings.topK);
    if (settings.reinforce) {
      await this.writeEpisodes.recordAccess(
        top.map((t) => t.episode.id),
        latestSequenceNo,
      );
    }
    return top;
  }
}
