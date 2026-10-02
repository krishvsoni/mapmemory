import { db, readDb } from './db/client.js';
import { LlmService } from './modules/llm/llm.service.js';
import { GraphService } from './modules/graph/graph.service.js';
import { TraversalService } from './modules/graph/traversal.service.js';
import { CentralityService } from './modules/graph/centrality.service.js';
import { PathfindingService } from './modules/graph/pathfinding.service.js';
import { EpisodeRepository } from './modules/graph/repository/episode.repository.js';
import { ConsolidationService } from './modules/memory/consolidation/consolidation.service.js';
import { RetrievalService } from './modules/memory/retrieval/retrieval.service.js';
import { ReflectionService } from './modules/memory/reflection/reflection.service.js';
import { TenantService } from './modules/tenant/tenant.service.js';
import { ApiKeyService } from './modules/auth/api-key.service.js';

export interface Container {
  llm: LlmService;
  graph: GraphService;
  traversal: TraversalService;
  centrality: CentralityService;
  pathfinding: PathfindingService;
  episodes: EpisodeRepository;
  consolidation: ConsolidationService;
  retrieval: RetrievalService;
  reflection: ReflectionService;
  tenants: TenantService;
  apiKeys: ApiKeyService;
}

export function buildContainer(): Container {
  const llm = new LlmService();

  // Writes always go to the primary pool.
  const graph = new GraphService(db);
  const episodes = new EpisodeRepository(db);
  const consolidation = new ConsolidationService(db, llm);
  const tenants = new TenantService(db);
  const apiKeys = new ApiKeyService(db);

  // Read-heavy graph traversal/analytics route to DATABASE_READ_URL when configured
  // (falls back to the primary pool otherwise — see db/client.ts).
  const readGraph = new GraphService(readDb);
  const readEpisodes = new EpisodeRepository(readDb);
  const centrality = new CentralityService(readGraph);
  const traversal = new TraversalService(readGraph, centrality);
  const pathfinding = new PathfindingService(readGraph);
  const retrieval = new RetrievalService(readGraph, traversal, readEpisodes, llm, episodes);
  const reflection = new ReflectionService(db, llm);

  return {
    llm,
    graph,
    traversal,
    centrality,
    pathfinding,
    episodes,
    consolidation,
    retrieval,
    reflection,
    tenants,
    apiKeys,
  };
}
