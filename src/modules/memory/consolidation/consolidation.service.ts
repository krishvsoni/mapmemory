import type { Database } from '../../../db/client.js';
import { GraphService } from '../../graph/graph.service.js';
import { EpisodeRepository } from '../../graph/repository/episode.repository.js';
import { RelationResolver } from '../../graph/relation-resolver.js';
import { withSpaceLock } from '../../distributed/space-lock.js';
import { invalidateCentralityCache } from '../../graph/centrality.service.js';
import type { LlmService } from '../../llm/llm.service.js';
import { clusterEntityLabels } from '../../graph/entity-resolver.js';
import { cosineSimilarity } from '../../../shared/utils/vector-math.js';
import { PriorityQueue } from '../../../shared/utils/priority-queue.js';
import { CONSOLIDATION_DEFAULTS, TRIPLET_CONSTRAINTS } from '../../../config/constants.js';
import { TripletExtractor } from '../extraction/triplet-extractor.js';
import { ContradictionResolver } from '../extraction/contradiction-resolver.js';
import type { EntityType, Episode, SemanticEdge, SemanticNode, Triplet } from '../../graph/graph.types.js';
import type { ExistingFactForPrompt, NewTripletForPrompt } from '../extraction/extraction.prompts.js';

export interface ConsolidationResult {
  episode: Episode;
  createdEdges: SemanticEdge[];
  corroboratedEdgeIds: string[];
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

function buildTypeByLabel(triplets: Triplet[]): Map<string, EntityType> {
  const typeByLabel = new Map<string, EntityType>();
  for (const t of triplets) {
    if (!typeByLabel.has(t.subject)) typeByLabel.set(t.subject, t.subjectType);
    if (!typeByLabel.has(t.object)) typeByLabel.set(t.object, t.objectType);
  }
  return typeByLabel;
}

export class ConsolidationService {
  private readonly extractor: TripletExtractor;
  private readonly resolver: ContradictionResolver;
  private readonly relations: RelationResolver;
  private readonly graph: GraphService;
  private readonly episodes: EpisodeRepository;

  constructor(
    private readonly db: Database,
    private readonly llm: LlmService,
  ) {
    this.extractor = new TripletExtractor(llm);
    this.resolver = new ContradictionResolver(llm);
    this.relations = new RelationResolver(db);
    this.graph = new GraphService(db);
    this.episodes = new EpisodeRepository(db);
  }

  async ingest(spaceId: string, observationText: string): Promise<ConsolidationResult> {
    const extraction = await this.extractor.extract(observationText);
    const triplets = dedupeTriplets(extraction.triplets);
    const episodeEmbedding = await this.llm.embedOne(observationText);

    if (triplets.length === 0) {
      return this.db.transaction(async (tx) => {
        const episodesTx = new EpisodeRepository(tx);
        const episode = await episodesTx.create(spaceId, observationText, episodeEmbedding, extraction.importance);
        return { episode, createdEdges: [], corroboratedEdgeIds: [], supersededEdgeIds: [] };
      });
    }

    return withSpaceLock(spaceId, () =>
      this.consolidate(spaceId, observationText, episodeEmbedding, extraction.importance, triplets),
    );
  }

  private async consolidate(
    spaceId: string,
    observationText: string,
    episodeEmbedding: number[],
    importance: number,
    triplets: Triplet[],
  ): Promise<ConsolidationResult> {
    const entityLabels = unique(triplets.flatMap((t) => [t.subject, t.object]));
    const relationTexts = unique(triplets.map((t) => t.relation));
    const tripletSentences = triplets.map(tripletText);
    const typeByLabel = buildTypeByLabel(triplets);

    const [entityEmbeddings, tripletEmbeddings, relationEmbeddings] = await Promise.all([
      this.llm.embedMany(entityLabels),
      this.llm.embedMany(tripletSentences),
      this.llm.embedMany(relationTexts),
    ]);
    const embeddingByLabel = new Map(entityLabels.map((label, i) => [label, entityEmbeddings[i] as number[]]));
    const embeddingByRelation = new Map(relationTexts.map((text, i) => [text, relationEmbeddings[i] as number[]]));

    const canonicalByLabel = clusterEntityLabels(entityLabels, embeddingByLabel, typeByLabel);
    const canonicalLabels = unique([...canonicalByLabel.values()]);

    const [{ supersedeByTripletIndex }, canonicalRelationByText] = await Promise.all([
      this.planContradictionResolution(spaceId, canonicalLabels, triplets, tripletEmbeddings),
      this.resolveCanonicalRelations(spaceId, relationTexts, embeddingByRelation),
    ]);

    const result = await this.db.transaction(async (tx) => {
      const graphTx = new GraphService(tx);
      const episodesTx = new EpisodeRepository(tx);

      const canonicalNodes = await Promise.all(
        canonicalLabels.map((label) =>
          graphTx.upsertNode(spaceId, label, embeddingByLabel.get(label) as number[], typeByLabel.get(label)),
        ),
      );
      const nodeByCanonicalLabel = new Map(canonicalLabels.map((label, i) => [label, canonicalNodes[i]]));
      const nodeIdByLabel = new Map(
        entityLabels.map((label) => [
          label,
          nodeByCanonicalLabel.get(canonicalByLabel.get(label) as string)?.id as string,
        ]),
      );

      const episode = await episodesTx.create(spaceId, observationText, episodeEmbedding, importance);

      const createdEdges: SemanticEdge[] = [];
      const corroboratedEdgeIds: string[] = [];
      const supersededEdgeIds: string[] = [];

      for (let index = 0; index < triplets.length; index += 1) {
        const triplet = triplets[index];
        if (!triplet) continue;
        const sourceId = nodeIdByLabel.get(triplet.subject);
        const targetId = nodeIdByLabel.get(triplet.object);
        const embedding = tripletEmbeddings[index];
        const canonicalRelation = canonicalRelationByText.get(triplet.relation) ?? triplet.relation;
        if (!sourceId || !targetId || !embedding) continue;

        const { edge, wasNew } = await graphTx.upsertOrCorroborateEdge(
          spaceId,
          sourceId,
          triplet.relation,
          canonicalRelation,
          targetId,
          embedding,
        );
        await episodesTx.linkEdge(episode.id, edge.id);
        if (wasNew) createdEdges.push(edge);
        else corroboratedEdgeIds.push(edge.id);

        const outdatedEdgeId = supersedeByTripletIndex.get(index);
        if (outdatedEdgeId && outdatedEdgeId !== edge.id) {
          await graphTx.supersede(outdatedEdgeId, edge.id);
          supersededEdgeIds.push(outdatedEdgeId);
        }
      }

      return { episode, createdEdges, corroboratedEdgeIds, supersededEdgeIds };
    });

    if (result.createdEdges.length > 0 || result.supersededEdgeIds.length > 0) {
      await invalidateCentralityCache(spaceId);
    }
    return result;
  }

  private async resolveCanonicalRelations(
    spaceId: string,
    relationTexts: string[],
    embeddingByRelation: Map<string, number[]>,
  ): Promise<Map<string, string>> {
    const entries = await Promise.all(
      relationTexts.map(async (text) => {
        const embedding = embeddingByRelation.get(text) as number[];
        return [text, await this.relations.resolve(spaceId, text, embedding)] as const;
      }),
    );
    return new Map(entries);
  }

  private async planContradictionResolution(
    spaceId: string,
    canonicalLabels: string[],
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
