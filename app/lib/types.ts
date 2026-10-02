export interface ProvisionedTenant {
  tenantId: string;
  name: string;
  plan: string;
  apiKey: string;
}

export interface MemorySpace {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface IngestJobResult {
  jobId: string;
  deduplicated?: boolean;
}

export interface JobStatus {
  jobId: string;
  state: string;
  result: unknown;
}

export interface PresentedFact {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
  score: number;
  depth: number;
}

export type EpisodeKind = 'raw' | 'reflection';

export interface RetrievedEpisode {
  episodeId: string;
  sequenceNo: number;
  kind: EpisodeKind;
  text: string;
  importance: number;
  relevance: number;
}

export interface RetrievalResult {
  facts: PresentedFact[];
  episodes: RetrievedEpisode[];
}

export interface Episode {
  id: string;
  spaceId: string;
  sequenceNo: number;
  rawText: string;
  kind: EpisodeKind;
  importance: number;
  accessCount: number;
  lastAccessedSequence: number | null;
}

export type ApiKeyRole = 'admin' | 'member' | 'readonly';

export interface ApiKeySummary {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  role: ApiKeyRole;
  scopedSpaceId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface IssuedApiKey {
  id: string;
  plaintext: string;
  role: ApiKeyRole;
  scopedSpaceId: string | null;
}

export interface UsageSummary {
  plan: string;
  spaces: { used: number; limit: number };
  episodesThisMonth: { used: number; limit: number };
}

export interface CentralEntity {
  nodeId: string;
  label: string;
  centrality: number;
}
