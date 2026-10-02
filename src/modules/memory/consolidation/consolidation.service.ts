import type { Database } from '../../../db/client.js';
import { GraphService } from '../../graph/graph.service.js';
import { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import type { LlmService } from '../../llm/llm.service.js';
import { clusterEntityLabels } from '../../graph/entity-resolver.js';
import { cosineSimilarity } from '../../../shared/utils/vector-math.js';
import { PriorityQueue } from '../../../shared/utils/priority-queue.js';
import { CONSOLIDATION_DEFAULTS, TRIPLET_CONSTRAINTS } from '../../../config/constants.js';
import { TripletExtractor } from '../extraction/triplet-extractor.js';
import { ContradictionResolver } from '../extraction/contradiction-resolver.js';
import type { Episode, SemanticEdge, SemanticNode, Triplet } from '../../graph/graph.types.js';
import type { ExistingFactForPrompt, NewTripletForPrompt } from '../extraction/extraction.prompts.js';

export interface ConsolidationResult {
  episode: Episode;
  createdEdges: SemanticEdge[];
  supersededEdgeIds: string[];
}

function tripletText(t: Triplet): string {
  return `${t.subject} ${t.relation} ${t.object}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function withinWordCeiling(t: Triplet): boolean {
  const words = (s: string): number => s.trim().split(/\s+/).length;
  return (
    words(t.subject) <= TRIPLET_CONSTRAINTS.hardWordCeiling &&
    words(t.relation) <= TRIPLET_CONSTRAINTS.hardWordCeiling &&
    words(t.object) <= TRIPLET_CONSTRAINTS.hardWordCeiling
  );
}

function dedupeTriplets(triplets: Triplet[]): Triplet[] {
  const seen = new Set<string>();
  const result: Triplet[] = [];
  for (const t of triplets) {
    if (!withinWordCeiling(t)) continue;
    const key = `${t.subject.toLowerCase()}|${t.relation.toLowerCase()}|${t.object.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }
  return result;
}

export class ConsolidationService {
  private readonly extractor: TripletExtractor;
  private readonly resolver: ContradictionResolver;
  private readonly graph: GraphService;
  private readonly episodes: EpisodeRepository;

  constructor(
    private readonly db: Database,
    private readonly llm: LlmService,
  ) {
    this.extractor = new TripletExtractor(llm);
    this.resolver = new ContradictionResolver(llm);
    this.graph = new GraphService(db);
    this.episodes = new EpisodeRepository(db);
  }

  async ingest(spaceId: string, observationText: string): Promise<ConsolidationResult> {
    const rawTriplets = await this.extractor.extract(observationText);
    const triplets = dedupeTriplets(rawTriplets);
    const episodeEmbedding = await this.llm.embedOne(observationText);

    if (triplets.length === 0) {
      return this.db.transaction(async (tx) => {
        const episodesTx = new EpisodeRepository(tx);
        const episode = await episodesTx.create(spaceId, observationText, episodeEmbedding);
        return { episode, createdEdges: [], supersededEdgeIds: [] };
      });
    }

    return this.consolidate(spaceId, observationText, episodeEmbedding, triplets);
  }

  private async consolidate(
    spaceId: string,
    observationText: string,
    episodeEmbedding: number[],
    triplets: Triplet[],
  ): Promise<ConsolidationResult> {
    const entityLabels = unique(triplets.flatMap((t) => [t.subject, t.object]));
    const tripletSentences = triplets.map(tripletText);

    const [entityEmbeddings, tripletEmbeddings] = await Promise.all([
      this.llm.embedMany(entityLabels),
      this.llm.embedMany(tripletSentences),
    ]);
    const embeddingByLabel = new Map(entityLabels.map((label, i) => [label, entityEmbeddings[i] as number[]]));

    const canonicalByLabel = clusterEntityLabels(entityLabels, embeddingByLabel);
    const canonicalLabels = unique([...canonicalByLabel.values()]);

    const { supersedeByTripletIndex } = await this.planContradictionResolution(
      spaceId,
      canonicalLabels,
      embeddingByLabel,
      triplets,
      tripletEmbeddings,
    );

    return this.db.transaction(async (tx) => {
      const graphTx = new GraphService(tx);
      const episodesTx = new EpisodeRepository(tx);

      const canonicalNodes = await Promise.all(
        canonicalLabels.map((label) => graphTx.upsertNode(spaceId, label, embeddingByLabel.get(label) as number[])),
      );
      const nodeByCanonicalLabel = new Map(canonicalLabels.map((label, i) => [label, canonicalNodes[i]]));
      const nodeIdByLabel = new Map(
        entityLabels.map((label) => [
          label,
          nodeByCanonicalLabel.get(canonicalByLabel.get(label) as string)?.id as string,
        ]),
      );

      const episode = await episodesTx.create(spaceId, observationText, episodeEmbedding);

      const createdEdges: SemanticEdge[] = [];
      const supersededEdgeIds: string[] = [];

      for (let index = 0; index < triplets.length; index += 1) {
        const triplet = triplets[index];
        if (!triplet) continue;
        const sourceId = nodeIdByLabel.get(triplet.subject);
        const targetId = nodeIdByLabel.get(triplet.object);
        const embedding = tripletEmbeddings[index];
        if (!sourceId || !targetId || !embedding) continue;

        const edge = await graphTx.edges.create(spaceId, sourceId, triplet.relation, targetId, embedding);
        await episodesTx.linkEdge(episode.id, edge.id);
        createdEdges.push(edge);

        const outdatedEdgeId = supersedeByTripletIndex.get(index);
        if (outdatedEdgeId) {
          await graphTx.supersede(outdatedEdgeId, edge.id);
          supersededEdgeIds.push(outdatedEdgeId);
        }
      }

      return { episode, createdEdges, supersededEdgeIds };
    });
  }

  private async planContradictionResolution(
    spaceId: string,
    canonicalLabels: string[],
    embeddingByLabel: Map<string, number[]>,
    triplets: Triplet[],
    tripletEmbeddings: number[][],
  ): Promise<{ supersedeByTripletIndex: Map<number, string> }> {
    const existingNodes = (
      await Promise.all(canonicalLabels.map((label) => this.graph.nodes.findByLabel(spaceId, label)))
    ).filter((n): n is SemanticNode => n !== null);

    const existingEdges = await this.graph.activeFactsAbout(
      spaceId,
      existingNodes.map((n) => n.id),
    );
    if (existingEdges.length === 0) return { supersedeByTripletIndex: new Map() };

    const referencedNodeIds = unique(existingEdges.flatMap((e) => [e.sourceNodeId, e.targetNodeId]));
    const referencedNodes = await this.graph.nodes.findByIds(referencedNodeIds);
    const labelById = new Map(referencedNodes.map((n) => [n.id, n.label]));

    const cappedEdges = this.rankByRelevance(existingEdges, tripletEmbeddings).topK(
      CONSOLIDATION_DEFAULTS.maxExistingFactsForContradictionPrompt,
    );

    const existingForPrompt: ExistingFactForPrompt[] = cappedEdges.map((edge) => ({
      edgeId: edge.id,
      subject: labelById.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      relation: edge.relation,
      object: labelById.get(edge.targetNodeId) ?? edge.targetNodeId,
    }));
    const incomingForPrompt: NewTripletForPrompt[] = triplets.map((t, index) => ({ index, ...t }));

    const supersedePairs = await this.resolver.resolve(existingForPrompt, incomingForPrompt);
    return { supersedeByTripletIndex: new Map(supersedePairs.map((p) => [p.newTripletIndex, p.existingEdgeId])) };
  }

  private rankByRelevance(edges: SemanticEdge[], tripletEmbeddings: number[][]): PriorityQueue<SemanticEdge> {
    const queue = new PriorityQueue<SemanticEdge>();
    for (const edge of edges) {
      if (!edge.embedding) continue;
      let best = 0;
      for (const tripletEmbedding of tripletEmbeddings) {
        best = Math.max(best, cosineSimilarity(edge.embedding, tripletEmbedding));
      }
      queue.push(edge, best);
    }
    return queue;
  }
}
