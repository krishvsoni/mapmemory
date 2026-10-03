import { HYBRID_RETRIEVAL } from '../../../config/constants.js';
import type { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import type { Episode } from '../../graph/graph.types.js';
import { lexicalSignalFromRank } from './episodic-scoring.js';

export interface EpisodeCandidates {
  episodeById: Map<string, Episode>;
  lexicalSignalById: Map<string, number>;
}

export async function gatherEpisodeCandidates(
  episodes: EpisodeRepository,
  spaceId: string,
  queryEmbedding: number[],
  queryText: string,
  linkedEpisodeIds: string[],
  hybrid: boolean,
): Promise<EpisodeCandidates> {
  const episodeById = new Map<string, Episode>();
  const lexicalSignalById = new Map<string, number>();

  const linked = await episodes.byIds(linkedEpisodeIds);
  for (const episode of linked) episodeById.set(episode.id, episode);
  if (!hybrid) return { episodeById, lexicalSignalById };

  const pool = HYBRID_RETRIEVAL.episodeCandidatePool;
  const [nearest, lexical] = await Promise.all([
    episodes.nearestByEmbedding(spaceId, queryEmbedding, pool),
    episodes.lexicalSearch(spaceId, queryText, pool),
  ]);
  for (const episode of [...nearest, ...lexical]) episodeById.set(episode.id, episode);
  lexical.forEach((episode, rank) => lexicalSignalById.set(episode.id, lexicalSignalFromRank(rank)));

  return { episodeById, lexicalSignalById };
}
