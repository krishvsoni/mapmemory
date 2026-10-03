import 'server-only';
import { apiFetch } from './api';
import type {
  ApiKeyRole,
  ApiKeySummary,
  CentralEntity,
  Episode,
  GraphSnapshot,
  PresentedFact,
  IngestJobResult,
  IssuedApiKey,
  JobStatus,
  MemorySpace,
  ProvisionedTenant,
  RetrievalResult,
  UsageSummary,
} from './types';

export function provisionTenant(name: string): Promise<ProvisionedTenant> {
  return apiFetch<ProvisionedTenant>('/v1/tenants', { method: 'POST', body: { name }, skipAuth: true });
}

export function listSpaces(): Promise<MemorySpace[]> {
  return apiFetch<MemorySpace[]>('/v1/spaces');
}

export function createSpace(name: string, description?: string): Promise<MemorySpace> {
  return apiFetch<MemorySpace>('/v1/spaces', { method: 'POST', body: { name, description } });
}

export function getSpace(spaceId: string): Promise<MemorySpace> {
  return apiFetch<MemorySpace>(`/v1/spaces/${spaceId}`);
}

export function ingestEpisode(spaceId: string, text: string): Promise<IngestJobResult> {
  return apiFetch<IngestJobResult>(`/v1/spaces/${spaceId}/episodes`, { method: 'POST', body: { text } });
}

export function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/v1/jobs/${jobId}`);
}

export function retrieve(spaceId: string, query: string): Promise<RetrievalResult> {
  return apiFetch<RetrievalResult>(`/v1/spaces/${spaceId}/retrieve`, { method: 'POST', body: { query } });
}

export function listEpisodes(spaceId: string): Promise<{ episodes: Episode[] }> {
  return apiFetch<{ episodes: Episode[] }>(`/v1/spaces/${spaceId}/episodes`);
}

export function triggerReflection(spaceId: string): Promise<{ reflection: Episode | null }> {
  return apiFetch<{ reflection: Episode | null }>(`/v1/spaces/${spaceId}/reflect`, { method: 'POST' });
}

export function listCentralEntities(spaceId: string): Promise<{ entities: CentralEntity[] }> {
  return apiFetch<{ entities: CentralEntity[] }>(`/v1/spaces/${spaceId}/entities/central`);
}

export function listApiKeys(): Promise<{ apiKeys: ApiKeySummary[] }> {
  return apiFetch<{ apiKeys: ApiKeySummary[] }>('/v1/api-keys');
}

export function issueApiKey(name: string, role: ApiKeyRole, scopedSpaceId?: string): Promise<IssuedApiKey> {
  return apiFetch<IssuedApiKey>('/v1/api-keys', { method: 'POST', body: { name, role, scopedSpaceId } });
}

export function revokeApiKey(apiKeyId: string): Promise<{ revoked: boolean }> {
  return apiFetch<{ revoked: boolean }>(`/v1/api-keys/${apiKeyId}`, { method: 'DELETE' });
}

export function getUsage(): Promise<UsageSummary> {
  return apiFetch<UsageSummary>('/v1/usage');
}

export interface SnapshotQuery {
  asOf?: string;
  includeHistory?: boolean;
  limit?: number;
}

export function getGraphSnapshot(spaceId: string, query: SnapshotQuery = {}): Promise<GraphSnapshot> {
  const params = new URLSearchParams();
  if (query.asOf) params.set('asOf', query.asOf);
  if (query.includeHistory) params.set('includeHistory', 'true');
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiFetch<GraphSnapshot>(`/v1/spaces/${spaceId}/graph${suffix}`);
}

export function getFactHistory(spaceId: string, edgeId: string): Promise<{ history: PresentedFact[] }> {
  return apiFetch<{ history: PresentedFact[] }>(`/v1/spaces/${spaceId}/edges/${edgeId}/history`);
}
