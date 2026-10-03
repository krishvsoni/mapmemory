'use client';

import { useExplorerStore } from './explorer.store';
import { GraphCanvas } from './graph-canvas';
import { FactHistoryPanel } from './fact-history-panel';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import type { GraphSnapshot } from '@/lib/types';

export function Explorer({ spaceId, initialSnapshot }: { spaceId: string; initialSnapshot: GraphSnapshot }) {
  const {
    snapshot,
    asOfDate,
    includeHistory,
    selectedNodeId,
    selectedEdgeId,
    history,
    isLoading,
    error,
    setAsOfDate,
    setIncludeHistory,
    selectNode,
    selectEdge,
  } = useExplorerStore();
  const visible = snapshot ?? initialSnapshot;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-slate-400 space-y-1">
            <span className="block uppercase tracking-wide">Show the graph as of</span>
            <input
              type="date"
              value={asOfDate ?? ''}
              onChange={(e) => setAsOfDate(spaceId, e.target.value || null)}
              className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          {asOfDate && (
            <Button variant="secondary" onClick={() => setAsOfDate(spaceId, null)}>
              Back to now
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={includeHistory}
              disabled={asOfDate !== null}
              onChange={(e) => setIncludeHistory(spaceId, e.target.checked)}
            />
            Include superseded facts
          </label>
          <span className="text-xs text-slate-500 ml-auto">
            {isLoading ? 'Loading…' : `${visible.nodes.length} entities · ${visible.edges.length} facts`}
          </span>
        </div>
      </Card>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          {visible.edges.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">No facts were known at this point.</p>
            </Card>
          ) : (
            <GraphCanvas
              snapshot={visible}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onSelectNode={selectNode}
              onSelectEdge={(edgeId) => selectEdge(spaceId, edgeId)}
            />
          )}
        </div>
        <FactHistoryPanel history={history} isLoading={selectedEdgeId !== null} />
      </div>
    </div>
  );
}
