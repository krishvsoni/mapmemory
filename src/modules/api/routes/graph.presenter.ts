import type { Container } from '../../../container.js';
import type { ScoredEdge } from '../../graph/graph.types.js';
import { edgeStatus, type FactStatus } from '../../graph/temporal.js';
import { confidenceFromCorroboration, invertEpisodeLinks, newestFirst } from '../../memory/retrieval/provenance.js';

const SOURCES_PER_FACT = 3;

export interface FactSource {
  episodeId: string;
  sequenceNo: number;
  occurredAt: string | null;
}

export interface PresentedFact {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
  score: number;
  depth: number;
  status: FactStatus;
  validFrom: string | null;
  validTo: string | null;
  confidence: number;
  corroborationCount: number;
  sources: FactSource[];
}

async function loadSourcesByEdge(container: Container, edgeIds: string[]): Promise<Map<string, FactSource[]>> {
  const edgeIdsByEpisode = await container.episodes.linkedEdgesByEpisode(edgeIds);
  const episodes = await container.episodes.byIds([...edgeIdsByEpisode.keys()]);
  const sourceByEpisode = new Map<string, FactSource>(
    episodes.map((e) => [
      e.id,
      { episodeId: e.id, sequenceNo: e.sequenceNo, occurredAt: (e.occurredAt ?? e.createdAt).toISOString() },
    ]),
  );

  const result = new Map<string, FactSource[]>();
  for (const [edgeId, episodeIds] of invertEpisodeLinks(edgeIdsByEpisode)) {
    const sources = episodeIds.map((id) => sourceByEpisode.get(id)).filter((s): s is FactSource => s !== undefined);
    result.set(edgeId, newestFirst(sources, SOURCES_PER_FACT));
  }
  return result;
}

export async function formatScoredEdges(container: Container, scored: ScoredEdge[]): Promise<PresentedFact[]> {
  const nodeIds = [...new Set(scored.flatMap((s) => [s.edge.sourceNodeId, s.edge.targetNodeId]))];
  const [nodes, sourcesByEdge] = await Promise.all([
    container.graph.nodes.findByIds(nodeIds),
    loadSourcesByEdge(
      container,
      scored.map((s) => s.edge.id),
    ),
  ]);
  const labelById = new Map(nodes.map((n) => [n.id, n.label]));

  return scored.map((s) => ({
    edgeId: s.edge.id,
    subject: labelById.get(s.edge.sourceNodeId) ?? s.edge.sourceNodeId,
    relation: s.edge.relation,
    object: labelById.get(s.edge.targetNodeId) ?? s.edge.targetNodeId,
    score: s.score,
    depth: s.depth,
    status: edgeStatus(s.edge),
    validFrom: (s.edge.validFrom ?? s.edge.createdAt).toISOString(),
    validTo: s.edge.validTo?.toISOString() ?? null,
    confidence: confidenceFromCorroboration(s.edge.corroborationCount),
    corroborationCount: s.edge.corroborationCount,
    sources: sourcesByEdge.get(s.edge.id) ?? [],
  }));
}
