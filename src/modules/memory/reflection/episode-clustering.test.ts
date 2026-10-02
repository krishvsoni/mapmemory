import { describe, expect, it } from 'vitest';
import { clusterEpisodesBySharedEntities } from './episode-clustering.js';

describe('clusterEpisodesBySharedEntities', () => {
  it('groups episodes that share an entity into one cluster', () => {
    const episodeIds = ['e1', 'e2', 'e3'];
    const entityIdsByEpisode = new Map<string, string[]>([
      ['e1', ['key', 'door']],
      ['e2', ['door', 'room']],
      ['e3', ['dragon']],
    ]);

    const clusters = clusterEpisodesBySharedEntities(episodeIds, entityIdsByEpisode);

    const topicCluster = clusters.find((c) => c.includes('e1'));
    expect(topicCluster).toEqual(expect.arrayContaining(['e1', 'e2']));
    expect(topicCluster).not.toContain('e3');
  });

  it('transitively merges episodes connected through a chain of shared entities', () => {
    const episodeIds = ['e1', 'e2', 'e3'];
    const entityIdsByEpisode = new Map<string, string[]>([
      ['e1', ['a']],
      ['e2', ['a', 'b']],
      ['e3', ['b']],
    ]);

    const clusters = clusterEpisodesBySharedEntities(episodeIds, entityIdsByEpisode);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toEqual(expect.arrayContaining(['e1', 'e2', 'e3']));
  });

  it('puts entity-less episodes in their own singleton clusters', () => {
    const episodeIds = ['e1', 'e2'];
    const clusters = clusterEpisodesBySharedEntities(episodeIds, new Map());

    expect(clusters).toHaveLength(2);
  });

  it('orders clusters largest first', () => {
    const episodeIds = ['e1', 'e2', 'e3', 'e4'];
    const entityIdsByEpisode = new Map<string, string[]>([
      ['e1', ['a']],
      ['e2', ['a']],
      ['e3', ['a']],
      ['e4', ['solo']],
    ]);

    const clusters = clusterEpisodesBySharedEntities(episodeIds, entityIdsByEpisode);

    expect(clusters[0]).toHaveLength(3);
    expect(clusters[1]).toHaveLength(1);
  });
});
