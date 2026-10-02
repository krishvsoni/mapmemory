import { UnionFind } from '../../../shared/utils/union-find.js';

export function clusterEpisodesBySharedEntities(
  episodeIds: string[],
  entityIdsByEpisode: Map<string, string[]>,
): string[][] {
  const uf = new UnionFind<string>();
  episodeIds.forEach((id) => uf.makeSet(id));

  const episodesByEntity = new Map<string, string[]>();
  for (const episodeId of episodeIds) {
    for (const entityId of entityIdsByEpisode.get(episodeId) ?? []) {
      const list = episodesByEntity.get(entityId) ?? [];
      list.push(episodeId);
      episodesByEntity.set(entityId, list);
    }
  }

  for (const linkedEpisodes of episodesByEntity.values()) {
    const [anchor, ...rest] = linkedEpisodes;
    if (!anchor) continue;
    for (const episodeId of rest) uf.union(anchor, episodeId);
  }

  return [...uf.groups().values()].sort((a, b) => b.length - a.length);
}
