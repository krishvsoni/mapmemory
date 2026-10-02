import { db } from './db/client.js';
import { LlmService } from './modules/llm/llm.service.js';
import { GraphService } from './modules/graph/graph.service.js';
import { TraversalService } from './modules/graph/traversal.service.js';
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
  episodes: EpisodeRepository;
  consolidation: ConsolidationService;
  retrieval: RetrievalService;
  reflection: ReflectionService;
  tenants: TenantService;
  apiKeys: ApiKeyService;
}

export function buildContainer(): Container {
  const llm = new LlmService();
  const graph = new GraphService(db);
  const traversal = new TraversalService(graph);
  const episodes = new EpisodeRepository(db);
  const consolidation = new ConsolidationService(db, llm);
  const retrieval = new RetrievalService(graph, traversal, episodes, llm);
  const reflection = new ReflectionService(db, llm);
  const tenants = new TenantService(db);
  const apiKeys = new ApiKeyService(db);

  return { llm, graph, traversal, episodes, consolidation, retrieval, reflection, tenants, apiKeys };
}
