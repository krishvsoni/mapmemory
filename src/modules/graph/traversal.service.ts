import { PriorityQueue } from '../../shared/utils/priority-queue.js';
import { cosineSimilarity } from '../../shared/utils/vector-math.js';
import { RETRIEVAL_DEFAULTS } from '../../config/constants.js';
import { normalizeScores } from './centrality.js';
import type { CentralityService } from './centrality.service.js';
import type { GraphService } from './graph.service.js';
import type { ScoredEdge, SemanticEdge } from './graph.types.js';

const CENTRALITY_BOOST_WEIGHT = 0.1;

export interface BeamSearchOptions {
  depth?: number;
  width?: number;
  minSimilarity?: number;
}

export class TraversalService {
  constructor(
    private readonly graph: GraphService,
    private readonly centrality?: CentralityService,
  ) {}

  async beamSearch(spaceId: string, queryEmbedding: number[], options: BeamSearchOptions = {}): Promise<ScoredEdge[]> {
    const depth = options.depth ?? RETRIEVAL_DEFAULTS.beamDepth;
    const width = options.width ?? RETRIEVAL_DEFAULTS.beamWidth;
    const minSimilarity = options.minSimilarity ?? RETRIEVAL_DEFAULTS.minSimilarity;
    const centralityScores = await this.loadCentrality(spaceId);

    const seeds = await this.graph.nodes.nearestByEmbedding(spaceId, queryEmbedding, width);
    let frontier = seeds.map((n) => n.id);
    const visitedNodes = new Set(frontier);
    const bestScoreByEdge = new Map<string, ScoredEdge>();

    for (let level = 1; level <= depth && frontier.length > 0; level += 1) {
      const candidates = await this.graph.activeFactsAbout(spaceId, frontier);
      const ranked = this.rankEdgesByQuery(candidates, queryEmbedding, minSimilarity, centralityScores);
      const top = ranked.topK(width);

      const nextFrontier: string[] = [];
      for (const scored of top) {
        const existing = bestScoreByEdge.get(scored.edge.id);
        if (!existing || existing.score < scored.score) {
          bestScoreByEdge.set(scored.edge.id, { ...scored, depth: level });
        }
        for (const nodeId of [scored.edge.sourceNodeId, scored.edge.targetNodeId]) {
          if (!visitedNodes.has(nodeId)) {
            visitedNodes.add(nodeId);
            nextFrontier.push(nodeId);
          }
        }
      }
      frontier = nextFrontier;
    }

    return [...bestScoreByEdge.values()].sort((a, b) => b.score - a.score);
  }

  private async loadCentrality(spaceId: string): Promise<Map<string, number> | null> {
    if (!this.centrality) return null;
    try {
      return normalizeScores(await this.centrality.computeForSpace(spaceId));
    } catch {
      return null;
    }
  }

  private rankEdgesByQuery(
    edges: SemanticEdge[],
    queryEmbedding: number[],
    minSimilarity: number,
    centralityScores: Map<string, number> | null,
  ): PriorityQueue<ScoredEdge> {
    const queue = new PriorityQueue<ScoredEdge>();
    for (const edge of edges) {
      if (!edge.embedding) continue;
      const similarity = cosineSimilarity(edge.embedding, queryEmbedding);
      if (similarity < minSimilarity) continue;

      const centralityBonus = centralityScores
        ? CENTRALITY_BOOST_WEIGHT *
          (((centralityScores.get(edge.sourceNodeId) ?? 0) + (centralityScores.get(edge.targetNodeId) ?? 0)) / 2)
        : 0;
      const score = similarity + centralityBonus;
      queue.push({ edge, score, depth: 0 }, score);
    }
    return queue;
  }
}
