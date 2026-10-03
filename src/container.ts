import { db, readDb } from './db/client.js';
import { LlmService } from './modules/llm/llm.service.js';
import { GraphService } from './modules/graph/graph.service.js';
import { TraversalService } from './modules/graph/traversal.service.js';
import { CentralityService } from './modules/graph/centrality.service.js';
import { PathfindingService } from './modules/graph/pathfinding.service.js';
import { GraphSnapshotService } from './modules/graph/snapshot.service.js';
import { EpisodeRepository } from './modules/graph/repository/episode.repository.js';
import { ConsolidationService } from './modules/memory/consolidation/consolidation.service.js';
import { RetrievalService } from './modules/memory/retrieval/retrieval.service.js';
import { ReflectionService } from './modules/memory/reflection/reflection.service.js';
import { TenantService } from './modules/tenant/tenant.service.js';
import { ApiKeyService } from './modules/auth/api-key.service.js';
import { OidcAuthService } from './modules/auth/oidc/oidc-auth.service.js';
import { SsoConfigRepository } from './modules/auth/oidc/sso-config.repository.js';
import { MemberRepository } from './modules/auth/oidc/member.repository.js';
import { AuditLogService } from './modules/audit/audit-log.service.js';
import { UsageService } from './modules/usage/usage.service.js';
import { StripeService } from './modules/billing/stripe.service.js';
import { DeveloperSessionService } from './modules/auth/developer-session.service.js';

export interface Container {
  llm: LlmService;
  graph: GraphService;
  traversal: TraversalService;
  centrality: CentralityService;
  pathfinding: PathfindingService;
  snapshots: GraphSnapshotService;
  episodes: EpisodeRepository;
  consolidation: ConsolidationService;
  retrieval: RetrievalService;
  reflection: ReflectionService;
  tenants: TenantService;
  apiKeys: ApiKeyService;
  oidcAuth: OidcAuthService;
  ssoConfigs: SsoConfigRepository;
  members: MemberRepository;
  auditLog: AuditLogService;
  usage: UsageService;
  billing: StripeService;
  developerSessions: DeveloperSessionService;
}

export function buildContainer(): Container {
  const llm = new LlmService();

  // Writes always go to the primary pool.
  const graph = new GraphService(db);
  const episodes = new EpisodeRepository(db);
  const consolidation = new ConsolidationService(db, llm);
  const tenants = new TenantService(db);
  const apiKeys = new ApiKeyService(db);
  const oidcAuth = new OidcAuthService(db);
  const ssoConfigs = new SsoConfigRepository(db);
  const members = new MemberRepository(db);
  const auditLog = new AuditLogService(db);
  const usage = new UsageService(tenants.spaces);
  const billing = new StripeService(db);
  const developerSessions = new DeveloperSessionService(db);

  // Read-heavy graph traversal/analytics route to DATABASE_READ_URL when configured
  // (falls back to the primary pool otherwise — see db/client.ts).
  const readGraph = new GraphService(readDb);
  const readEpisodes = new EpisodeRepository(readDb);
  const centrality = new CentralityService(readGraph);
  const traversal = new TraversalService(readGraph, centrality);
  const pathfinding = new PathfindingService(readGraph);
  const snapshots = new GraphSnapshotService(readGraph, centrality);
  const retrieval = new RetrievalService(readGraph, traversal, readEpisodes, llm, episodes);
  const reflection = new ReflectionService(db, llm);

  return {
    llm,
    graph,
    traversal,
    centrality,
    pathfinding,
    snapshots,
    episodes,
    consolidation,
    retrieval,
    reflection,
    tenants,
    apiKeys,
    oidcAuth,
    ssoConfigs,
    members,
    auditLog,
    usage,
    billing,
    developerSessions,
  };
}
