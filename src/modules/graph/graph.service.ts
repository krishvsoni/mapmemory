import type { DbClient } from '../../db/client.js';
import { NodeRepository } from './repository/node.repository.js';
import { EdgeRepository } from './repository/edge.repository.js';
import type { SemanticEdge, SemanticNode } from './graph.types.js';

export class GraphService {
  readonly nodes: NodeRepository;
  readonly edges: EdgeRepository;

  constructor(db: DbClient) {
    this.nodes = new NodeRepository(db);
    this.edges = new EdgeRepository(db);
  }

  async upsertNode(spaceId: string, label: string, embedding: number[]): Promise<SemanticNode> {
    const existing = await this.nodes.findByLabel(spaceId, label);
    if (existing) return existing;
    return this.nodes.create(spaceId, label, embedding);
  }

  async addFact(
    spaceId: string,
    subjectLabel: string,
    relation: string,
    objectLabel: string,
    tripletEmbedding: number[],
    subjectEmbedding: number[],
    objectEmbedding: number[],
  ): Promise<SemanticEdge> {
    const subject = await this.upsertNode(spaceId, subjectLabel, subjectEmbedding);
    const object = await this.upsertNode(spaceId, objectLabel, objectEmbedding);
    return this.edges.create(spaceId, subject.id, relation, object.id, tripletEmbedding);
  }

  async supersede(oldEdgeId: string, newEdgeId: string): Promise<void> {
    await this.edges.supersede(oldEdgeId, newEdgeId);
  }

  async activeFactsAbout(spaceId: string, nodeIds: string[]): Promise<SemanticEdge[]> {
    const edges = await this.edges.activeEdgesTouchingNodes(spaceId, nodeIds);
    return edges.filter((edge) => edge.supersededByEdgeId === null);
  }
}
