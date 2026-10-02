import 'server-only';
import { getApiKey } from './session';

const API_URL = process.env.MAPMEMORY_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!options.skipAuth) {
    const apiKey = await getApiKey();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const errorBody = payload as { code?: string; message?: string } | undefined;
    throw new ApiError(response.status, errorBody?.code ?? 'UNKNOWN_ERROR', errorBody?.message ?? response.statusText);
  }

  return payload as T;
}
