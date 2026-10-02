'use client';

import { useState, type FormEvent } from 'react';
import { useWorkbenchStore } from './workbench.store';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';

export function Workbench({ spaceId }: { spaceId: string }) {
  const [ingestText, setIngestText] = useState('');
  const [query, setQuery] = useState('');

  const {
    isIngesting,
    isRetrieving,
    lastJobId,
    lastJobState,
    retrievalResult,
    error,
    ingest,
    checkJob,
    runRetrieval,
    reflect,
  } = useWorkbenchStore();

  async function handleIngest(event: FormEvent): Promise<void> {
    event.preventDefault();
    await ingest(spaceId, ingestText);
    setIngestText('');
  }

  async function handleRetrieve(event: FormEvent): Promise<void> {
    event.preventDefault();
    await runRetrieval(spaceId, query);
  }

  return (
    <div className="space-y-4">
      <Card title="Ingest an observation">
        <form onSubmit={handleIngest} className="space-y-2">
          <TextInput
            value={ingestText}
            onChange={(e) => setIngestText(e.target.value)}
            placeholder="e.g. Bob picked up the rusty key"
            maxLength={8000}
            required
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isIngesting}>
              {isIngesting ? 'Submitting…' : 'Ingest'}
            </Button>
            {lastJobId && (
              <>
                <Badge tone={lastJobState === 'completed' ? 'success' : 'default'}>{lastJobState ?? 'unknown'}</Badge>
                <button
                  type="button"
                  onClick={() => checkJob(lastJobId)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  refresh status
                </button>
              </>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="Retrieve"
        actions={
          <button onClick={() => reflect(spaceId)} className="text-xs text-indigo-400 hover:text-indigo-300">
            trigger reflection
          </button>
        }
      >
        <form onSubmit={handleRetrieve} className="space-y-2">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about this space"
            required
          />
          <Button type="submit" disabled={isRetrieving}>
            {isRetrieving ? 'Searching…' : 'Retrieve'}
          </Button>
        </form>

        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>

        {retrievalResult && (
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="text-xs uppercase text-slate-500 mb-1">Facts</h3>
              {retrievalResult.facts.length === 0 ? (
                <p className="text-sm text-slate-500">No facts found.</p>
              ) : (
                <ul className="space-y-1">
                  {retrievalResult.facts.map((fact) => (
                    <li key={fact.edgeId} className="text-sm text-slate-300">
                      <span className="text-slate-100">{fact.subject}</span>{' '}
                      <span className="text-indigo-400">{fact.relation}</span>{' '}
                      <span className="text-slate-100">{fact.object}</span>
                      <span className="text-slate-600 text-xs"> ({fact.score.toFixed(2)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs uppercase text-slate-500 mb-1">Episodes</h3>
              {retrievalResult.episodes.length === 0 ? (
                <p className="text-sm text-slate-500">No episodes found.</p>
              ) : (
                <ul className="space-y-1">
                  {retrievalResult.episodes.map((episode) => (
                    <li key={episode.episodeId} className="text-sm text-slate-300">
                      <Badge tone={episode.kind === 'reflection' ? 'warning' : 'default'}>{episode.kind}</Badge>{' '}
                      {episode.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
