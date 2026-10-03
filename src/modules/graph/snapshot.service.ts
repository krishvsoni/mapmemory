import type { CentralityService } from './centrality.service.js';
import type { GraphService } from './graph.service.js';
import type { SemanticEdge } from './graph.types.js';
import { confidenceFromCorroboration } from '../memory/retrieval/provenance.js';
import { edgeStatus, type FactScope, type FactStatus } from './temporal.js';

export const SNAPSHOT_LIMITS = {
  defaultEntities: 25,
  maxEntities: 100,
  maxEdges: 300,
} as const;

export interface SnapshotNode {
  id: string;
  label: string;
  entityType: string | null;
  centrality: number;
}

export interface SnapshotEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  status: FactStatus;
  validFrom: string;
  validTo: string | null;
  confidence: number;
}

export interface GraphSnapshot {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

export function strongestEdges(edges: SemanticEdge[], limit: number): SemanticEdge[] {
  return [...edges].sort((a, b) => b.corroborationCount - a.corroborationCount).slice(0, limit);
}

export class GraphSnapshotService {
  constructor(
    private readonly graph: GraphService,
    private readonly centrality: CentralityService,
  ) {}

  async snapshot(spaceId: string, entityLimit: number, scope: FactScope): Promise<GraphSnapshot> {
    const scores = await this.centrality.computeForSpace(spaceId);
    const seedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.min(entityLimit, SNAPSHOT_LIMITS.maxEntities))
      .map(([nodeId]) => nodeId);

    const edges = strongestEdges(await this.graph.factsAbout(spaceId, seedIds, scope), SNAPSHOT_LIMITS.maxEdges);
    const nodeIds = [...new Set(edges.flatMap((e) => [e.sourceNodeId, e.targetNodeId]))];
    const nodes = await this.graph.nodes.findByIds(nodeIds);

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        entityType: n.entityType,
        centrality: scores.get(n.id) ?? 0,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceId: e.sourceNodeId,
        targetId: e.targetNodeId,
        relation: e.relation,
        status: edgeStatus(e),
        validFrom: (e.validFrom ?? e.createdAt).toISOString(),
        validTo: e.validTo?.toISOString() ?? null,
        confidence: confidenceFromCorroboration(e.corroborationCount),
      })),
    };
  }
}
