import { create } from 'zustand';
import { factHistoryAction, graphSnapshotAction } from './explorer-actions';
import type { GraphSnapshot, PresentedFact } from '@/lib/types';

interface ExplorerState {
  snapshot: GraphSnapshot | null;
  asOfDate: string | null;
  includeHistory: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  history: PresentedFact[] | null;
  isLoading: boolean;
  error: string | null;

  setAsOfDate: (spaceId: string, date: string | null) => Promise<void>;
  setIncludeHistory: (spaceId: string, include: boolean) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (spaceId: string, edgeId: string | null) => Promise<void>;
}

function endOfDayIso(date: string | null): string | null {
  return date ? `${date}T23:59:59.000Z` : null;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useExplorerStore = create<ExplorerState>((set, get) => {
  async function reload(spaceId: string, asOfDate: string | null, includeHistory: boolean): Promise<void> {
    set({ isLoading: true, error: null, asOfDate, includeHistory });
    try {
      const snapshot = await graphSnapshotAction(spaceId, endOfDayIso(asOfDate), includeHistory);
      set({ snapshot, isLoading: false, selectedNodeId: null, selectedEdgeId: null, history: null });
    } catch (error) {
      set({ isLoading: false, error: messageOf(error, 'Could not load the graph') });
    }
  }

  return {
    snapshot: null,
    asOfDate: null,
    includeHistory: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    history: null,
    isLoading: false,
    error: null,

    setAsOfDate: (spaceId, date) => reload(spaceId, date, get().includeHistory),
    setIncludeHistory: (spaceId, include) => reload(spaceId, get().asOfDate, include),

    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null, history: null }),

    selectEdge: async (spaceId, edgeId) => {
      if (edgeId === null) {
        set({ selectedEdgeId: null, history: null });
        return;
      }
      set({ selectedEdgeId: edgeId, history: null, error: null });
      try {
        const history = await factHistoryAction(spaceId, edgeId);
        if (get().selectedEdgeId === edgeId) set({ history });
      } catch (error) {
        set({ error: messageOf(error, 'Could not load fact history') });
      }
    },
  };
});
