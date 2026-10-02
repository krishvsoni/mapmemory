import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../db/client.js';
import { env } from '../config/env.js';
import { episodeSources } from '../db/schema/graph.schema.js';
import { tenants as tenantsTable } from '../db/schema/tenant.schema.js';
import { TenantService } from '../modules/tenant/tenant.service.js';
import { GraphService } from '../modules/graph/graph.service.js';
import { TraversalService } from '../modules/graph/traversal.service.js';
import { EpisodeRepository } from '../modules/graph/repository/episode.repository.js';
import { LlmService } from '../modules/llm/llm.service.js';
import { ConsolidationService } from '../modules/memory/consolidation/consolidation.service.js';
import { RetrievalService } from '../modules/memory/retrieval/retrieval.service.js';
import { ReflectionService } from '../modules/memory/reflection/reflection.service.js';
import { ScriptedLlmProvider } from './support/scripted-llm-provider.js';

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const probe = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    await probe.query('SELECT 1');
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDatabaseReachable();

describe.skipIf(!dbAvailable)('memory loop integration (real Postgres + Redis)', () => {
  const provider = new ScriptedLlmProvider(env.EMBEDDING_DIMENSIONS);
  const llm = new LlmService(provider);
  const graph = new GraphService(db);
  const traversal = new TraversalService(graph);
  const episodes = new EpisodeRepository(db);
  const tenants = new TenantService(db);
  const consolidation = new ConsolidationService(db, llm);
  const retrieval = new RetrievalService(graph, traversal, episodes, llm, episodes);
  const reflection = new ReflectionService(db, llm);

  let tenantId: string;
  let spaceId: string;
  let bobHasKeyEdgeId: string;

  beforeAll(async () => {
    const provisioned = await tenants.provision('integration-test-tenant');
    tenantId = provisioned.tenant.id;
    const space = await tenants.createSpace(tenantId, 'integration-test-space');
    spaceId = space.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
    await pool.end();
  });

  it('ingests an observation into real nodes, edges, and an episode', async () => {
    provider.enqueue(
      JSON.stringify({
        importance: 7,
        triplets: [{ subject: 'bob', relation: 'has', object: 'key', subjectType: 'person', objectType: 'item' }],
      }),
    );

    const result = await consolidation.ingest(spaceId, 'bob has key');

    expect(result.createdEdges).toHaveLength(1);
    expect(result.episode.importance).toBe(7);
    bobHasKeyEdgeId = result.createdEdges[0]?.id as string;

    const bobNode = await graph.nodes.findByLabel(spaceId, 'bob');
    const keyNode = await graph.nodes.findByLabel(spaceId, 'key');
    expect(bobNode).not.toBeNull();
    expect(keyNode).not.toBeNull();
  });

  it('corroborates a restated fact instead of duplicating it', async () => {
    provider.enqueue(
      JSON.stringify({
        importance: 5,
        triplets: [{ subject: 'bob', relation: 'has', object: 'key', subjectType: 'person', objectType: 'item' }],
      }),
    );
    provider.enqueue(JSON.stringify({ supersede: [] }));

    const result = await consolidation.ingest(spaceId, 'bob has key');

    expect(result.createdEdges).toHaveLength(0);
    expect(result.corroboratedEdgeIds).toEqual([bobHasKeyEdgeId]);

    const [edge] = await graph.edges.byIds([bobHasKeyEdgeId]);
    expect(edge?.corroborationCount).toBe(2);
  });

  it('supersedes an outdated fact via contradiction resolution', async () => {
    provider.enqueue(
      JSON.stringify({
        importance: 6,
        triplets: [{ subject: 'bob', relation: 'has', object: 'sword', subjectType: 'person', objectType: 'item' }],
      }),
    );
    provider.enqueue(JSON.stringify({ supersede: [{ existingEdgeId: bobHasKeyEdgeId, newTripletIndex: 0 }] }));

    const result = await consolidation.ingest(spaceId, 'bob has sword');

    expect(result.supersededEdgeIds).toEqual([bobHasKeyEdgeId]);

    const [oldEdge] = await graph.edges.byIds([bobHasKeyEdgeId]);
    expect(oldEdge?.supersededByEdgeId).toBe(result.createdEdges[0]?.id);
  });

  it('ingests a fourth, unrelated fact about the same entity', async () => {
    provider.enqueue(
      JSON.stringify({
        importance: 4,
        triplets: [{ subject: 'bob', relation: 'likes', object: 'cake', subjectType: 'person', objectType: 'item' }],
      }),
    );
    provider.enqueue(JSON.stringify({ supersede: [] }));

    const result = await consolidation.ingest(spaceId, 'bob likes cake');
    expect(result.createdEdges).toHaveLength(1);
  });

  it('retrieves active facts via beam search, proving the inArray fix holds end to end', async () => {
    const result = await retrieval.retrieve(spaceId, 'bob has sword');

    const objects = result.facts.map((f) => f.edge.relation);
    expect(result.facts.length).toBeGreaterThan(0);
    expect(objects).toContain('has');
    expect(result.facts.some((f) => f.edge.supersededByEdgeId !== null)).toBe(false);
  });

  it('clusters topic-connected episodes and synthesizes a reflection', async () => {
    provider.enqueue('Bob tends to acquire items and has clear preferences among them.');

    const reflectionEpisode = await reflection.reflect(spaceId);

    expect(reflectionEpisode).not.toBeNull();
    expect(reflectionEpisode?.kind).toBe('reflection');

    const sources = await db
      .select()
      .from(episodeSources)
      .where(eq(episodeSources.reflectionEpisodeId, reflectionEpisode?.id as string));
    expect(sources.length).toBeGreaterThanOrEqual(4);
  });
});
