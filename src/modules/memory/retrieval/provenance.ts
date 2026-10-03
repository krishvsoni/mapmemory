export function confidenceFromCorroboration(corroborationCount: number): number {
  return 1 - Math.pow(0.5, Math.max(1, corroborationCount));
}

export function invertEpisodeLinks(edgeIdsByEpisode: Map<string, string[]>): Map<string, string[]> {
  const episodeIdsByEdge = new Map<string, string[]>();
  for (const [episodeId, edgeIds] of edgeIdsByEpisode) {
    for (const edgeId of edgeIds) {
      const list = episodeIdsByEdge.get(edgeId) ?? [];
      list.push(episodeId);
      episodeIdsByEdge.set(edgeId, list);
    }
  }
  return episodeIdsByEdge;
}

export function newestFirst<T extends { sequenceNo: number }>(sources: T[], limit: number): T[] {
  return [...sources].sort((a, b) => b.sequenceNo - a.sequenceNo).slice(0, limit);
}
