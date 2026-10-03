export interface McpFact {
  edgeId: string;
  subject: string;
  relation: string;
  object: string;
  status: 'current' | 'superseded';
  validFrom: string | null;
  validTo: string | null;
  confidence: number;
}

export interface McpEpisode {
  episodeId: string;
  kind: string;
  occurredAt: string;
  text: string;
}

export interface RecallResponse {
  intent: string;
  facts: McpFact[];
  episodes: McpEpisode[];
}

export interface HistoryResponse {
  history: McpFact[];
}

export interface JobResponse {
  jobId: string;
  state: string;
  result?: unknown;
}

export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultSpaceId?: string;
}

export class MapMemoryApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class MapMemoryClient {
  constructor(private readonly config: ClientConfig) {}

  resolveSpace(spaceId: string | undefined): string {
    const resolved = spaceId ?? this.config.defaultSpaceId;
    if (!resolved) throw new Error('No memory space: pass spaceId or set MAPMEMORY_SPACE_ID');
    return resolved;
  }

  remember(spaceId: string, text: string, occurredAt?: string): Promise<{ jobId: string }> {
    return this.request('POST', `/v1/spaces/${spaceId}/episodes`, { text, occurredAt });
  }

  recall(
    spaceId: string,
    query: string,
    options: { asOf?: string; includeHistory?: boolean },
  ): Promise<RecallResponse> {
    return this.request('POST', `/v1/spaces/${spaceId}/retrieve`, { query, ...options });
  }

  factHistory(spaceId: string, edgeId: string): Promise<HistoryResponse> {
    return this.request('GET', `/v1/spaces/${spaceId}/edges/${edgeId}/history`);
  }

  job(jobId: string): Promise<JobResponse> {
    return this.request('GET', `/v1/jobs/${jobId}`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new MapMemoryApiError(response.status, `mapmemory API ${response.status}: ${detail.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }
}
