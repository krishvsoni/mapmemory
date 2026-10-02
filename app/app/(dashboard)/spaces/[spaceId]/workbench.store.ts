import { create } from 'zustand';
import { ingestAction, pollJobAction, reflectAction, retrieveAction } from './actions';
import type { RetrievalResult } from '@/lib/types';

interface WorkbenchState {
  isIngesting: boolean;
  isRetrieving: boolean;
  lastJobId: string | null;
  lastJobState: string | null;
  retrievalResult: RetrievalResult | null;
  error: string | null;

  ingest: (spaceId: string, text: string) => Promise<void>;
  checkJob: (jobId: string) => Promise<void>;
  runRetrieval: (spaceId: string, query: string) => Promise<void>;
  reflect: (spaceId: string) => Promise<void>;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  isIngesting: false,
  isRetrieving: false,
  lastJobId: null,
  lastJobState: null,
  retrievalResult: null,
  error: null,

  ingest: async (spaceId, text) => {
    set({ isIngesting: true, error: null });
    try {
      const result = await ingestAction(spaceId, text);
      set({ isIngesting: false, lastJobId: result.jobId, lastJobState: 'queued' });
    } catch (error) {
      set({ isIngesting: false, error: messageOf(error, 'Ingestion failed') });
    }
  },

  checkJob: async (jobId) => {
    try {
      const status = await pollJobAction(jobId);
      set({ lastJobState: status.state });
    } catch {
      // transient poll failures are not surfaced as page-level errors
    }
  },

  runRetrieval: async (spaceId, query) => {
    set({ isRetrieving: true, error: null });
    try {
      const result = await retrieveAction(spaceId, query);
      set({ isRetrieving: false, retrievalResult: result });
    } catch (error) {
      set({ isRetrieving: false, error: messageOf(error, 'Retrieval failed') });
    }
  },

  reflect: async (spaceId) => {
    try {
      await reflectAction(spaceId);
    } catch (error) {
      set({ error: messageOf(error, 'Reflection failed') });
    }
  },
}));
