import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import type { PresentedFact } from '@/lib/types';

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : 'unknown';
}

function FactVersion({ fact }: { fact: PresentedFact }) {
  return (
    <li className="border-l-2 border-slate-700 pl-3 space-y-1">
      <p className="text-sm text-slate-200">
        {fact.subject} <span className="text-indigo-400">{fact.relation}</span> {fact.object}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge tone={fact.status === 'current' ? 'success' : 'default'}>{fact.status}</Badge>
        <span>
          {day(fact.validFrom)} → {fact.validTo ? day(fact.validTo) : 'now'}
        </span>
        <span>confidence {(fact.confidence * 100).toFixed(0)}%</span>
        <span>seen {fact.corroborationCount}×</span>
      </div>
      {fact.sources.length > 0 && (
        <p className="text-xs text-slate-600">
          from episode{fact.sources.length > 1 ? 's' : ''} {fact.sources.map((s) => `#${s.sequenceNo}`).join(', ')}
        </p>
      )}
    </li>
  );
}

export function FactHistoryPanel({ history, isLoading }: { history: PresentedFact[] | null; isLoading: boolean }) {
  return (
    <Card title="Fact history">
      {history === null ? (
        <p className="text-sm text-slate-500">{isLoading ? 'Loading…' : 'Select an edge to see how this fact changed.'}</p>
      ) : (
        <ol className="space-y-3">
          {history.map((fact) => (
            <FactVersion key={fact.edgeId} fact={fact} />
          ))}
        </ol>
      )}
    </Card>
  );
}
