import { PriorityQueue } from '../../shared/utils/priority-queue.js';
import { cosineSimilarity } from '../../shared/utils/vector-math.js';
import { reciprocalRankFusion } from '../../shared/utils/rank-fusion.js';
import { RETRIEVAL_DEFAULTS } from '../../config/constants.js';
import { normalizeScores } from './centrality.js';
import type { CentralityService } from './centrality.service.js';
import type { GraphService } from './graph.service.js';
import type { ScoredEdge, SemanticEdge, SemanticNode } from './graph.types.js';
import { CURRENT_SCOPE, type FactScope } from './temporal.js';

const CENTRALITY_BOOST_WEIGHT = 0.1;
const SEED_OVERFETCH = 2;

export interface BeamSearchOptions {
  depth?: number;
  width?: number;
  minSimilarity?: number;
  queryText?: string;
  scope?: FactScope;
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
    const scope = options.scope ?? CURRENT_SCOPE;
    const centralityScores = await this.loadCentrality(spaceId);

    const seeds = await this.seedNodes(spaceId, queryEmbedding, width, options.queryText);
    let frontier = seeds.map((n) => n.id);
    const visitedNodes = new Set(frontier);
    const bestScoreByEdge = new Map<string, ScoredEdge>();

    for (let level = 1; level <= depth && frontier.length > 0; level += 1) {
      const candidates = await this.graph.factsAbout(spaceId, frontier, scope);
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

  private async seedNodes(
    spaceId: string,
    queryEmbedding: number[],
    width: number,
    queryText: string | undefined,
  ): Promise<SemanticNode[]> {
    const fetchLimit = queryText ? width * SEED_OVERFETCH : width;
    const semantic = await this.graph.nodes.nearestByEmbedding(spaceId, queryEmbedding, fetchLimit);
    if (!queryText) return semantic;

    const lexical = await this.graph.nodes.lexicalSearch(spaceId, queryText, fetchLimit);
    if (lexical.length === 0) return semantic.slice(0, width);

    return reciprocalRankFusion([semantic, lexical], (n) => n.id)
      .slice(0, width)
      .map((fused) => fused.item);
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
