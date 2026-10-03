import type { DbClient } from '../../db/client.js';
import { NodeRepository } from './repository/node.repository.js';
import { EdgeRepository } from './repository/edge.repository.js';
import type { EntityType, SemanticEdge, SemanticNode } from './graph.types.js';
import { CURRENT_SCOPE, type FactScope } from './temporal.js';

export class GraphService {
  readonly nodes: NodeRepository;
  readonly edges: EdgeRepository;

  constructor(db: DbClient) {
    this.nodes = new NodeRepository(db);
    this.edges = new EdgeRepository(db);
  }

  async upsertNode(spaceId: string, label: string, embedding: number[], entityType?: EntityType): Promise<SemanticNode> {
    const existing = await this.nodes.findByLabel(spaceId, label);
    if (existing) return existing;
    return this.nodes.create(spaceId, label, embedding, entityType);
  }

  async upsertOrCorroborateEdge(
    spaceId: string,
    sourceNodeId: string,
    relation: string,
    canonicalRelation: string,
    targetNodeId: string,
    embedding: number[],
    validFrom?: Date | null,
  ): Promise<{ edge: SemanticEdge; wasNew: boolean }> {
    const existing = await this.edges.findActiveMatch(spaceId, sourceNodeId, canonicalRelation, targetNodeId);
    if (existing) {
      return { edge: await this.edges.corroborate(existing.id), wasNew: false };
    }
    const created = await this.edges.create(spaceId, sourceNodeId, relation, targetNodeId, embedding, canonicalRelation, validFrom);
    return { edge: created, wasNew: true };
  }

  async supersede(oldEdgeId: string, newEdgeId: string, validTo?: Date): Promise<void> {
    await this.edges.supersede(oldEdgeId, newEdgeId, validTo);
  }

  async activeFactsAbout(spaceId: string, nodeIds: string[]): Promise<SemanticEdge[]> {
    return this.edges.edgesTouchingNodes(spaceId, nodeIds, CURRENT_SCOPE);
  }

  async factsAbout(spaceId: string, nodeIds: string[], scope: FactScope): Promise<SemanticEdge[]> {
    return this.edges.edgesTouchingNodes(spaceId, nodeIds, scope);
  }
}
