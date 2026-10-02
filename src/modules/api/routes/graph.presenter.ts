import type { Container } from '../../../container.js';
import type { ScoredEdge } from '../../graph/graph.types.js';

export interface PresentedFact {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
  score: number;
  depth: number;
}

export async function formatScoredEdges(container: Container, scored: ScoredEdge[]): Promise<PresentedFact[]> {
  const nodeIds = [...new Set(scored.flatMap((s) => [s.edge.sourceNodeId, s.edge.targetNodeId]))];
  const nodes = await container.graph.nodes.findByIds(nodeIds);
  const labelById = new Map(nodes.map((n) => [n.id, n.label]));

  return scored.map((s) => ({
    edgeId: s.edge.id,
    subject: labelById.get(s.edge.sourceNodeId) ?? s.edge.sourceNodeId,
    relation: s.edge.relation,
    object: labelById.get(s.edge.targetNodeId) ?? s.edge.targetNodeId,
    score: s.score,
    depth: s.depth,
  }));
}
