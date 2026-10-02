'use client';

import { useActionState } from 'react';
import { issueApiKeyAction, type IssueKeyFormState } from './actions';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { ErrorBanner } from '@/components/ErrorBanner';
import type { MemorySpace } from '@/lib/types';

const initialState: IssueKeyFormState = { error: null, issued: null };
const selectClass = 'w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100';

export function IssueKeyForm({ spaces }: { spaces: MemorySpace[] }) {
  const [state, formAction, isPending] = useActionState(issueApiKeyAction, initialState);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-2">
        <TextInput name="name" placeholder="Key name (e.g. 'backend service')" required />
        <select name="role" className={selectClass} defaultValue="member">
          <option value="admin">admin — full tenant access</option>
          <option value="member">member — ingest &amp; retrieve</option>
          <option value="readonly">readonly — retrieve only</option>
        </select>
        <select name="scopedSpaceId" className={selectClass} defaultValue="">
          <option value="">No space scope (tenant-wide)</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <ErrorBanner message={state.error} />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Issuing…' : 'Issue key'}
        </Button>
      </form>

      {state.issued && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-md p-3 text-sm">
          <p className="text-emerald-300 font-medium mb-1">Key issued — copy it now, it won&apos;t be shown again:</p>
          <code className="block bg-slate-950 rounded px-2 py-1 text-xs text-slate-200 break-all">
            {state.issued.plaintext}
          </code>
        </div>
      )}
    </div>
  );
}
