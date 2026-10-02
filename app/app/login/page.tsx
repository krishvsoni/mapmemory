'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createTenantAction, useExistingKeyAction } from './actions';
import { initialFormState } from './form-state';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Card } from '@/components/Card';

export default function LoginPage() {
  const [createState, createAction, isCreating] = useActionState(createTenantAction, initialFormState);
  const [existingState, existingAction, isUsingExisting] = useActionState(useExistingKeyAction, initialFormState);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">mapmemory</h1>
          <p className="text-slate-400 text-sm mt-1">Graph memory for LLM agents</p>
        </div>

        <Card title="For developers">
          <div className="space-y-2">
            <Link href="/login/developer">
              <Button type="button" className="w-full">
                Sign in with Kinde
              </Button>
            </Link>
            <p className="text-xs text-slate-500">
              Your own isolated workspace, provisioned automatically on first sign-in.
            </p>
          </div>
        </Card>

        <Card title="For organizations">
          <Link href="/login/enterprise">
            <Button type="button" variant="secondary" className="w-full">
              Enterprise sign-in (SSO)
            </Button>
          </Link>
        </Card>

        <details className="group">
          <summary className="text-sm text-slate-500 hover:text-slate-300 cursor-pointer select-none">
            Advanced: create a tenant or use an existing API key directly
          </summary>
          <div className="mt-3 space-y-4">
            <Card title="Create a tenant">
              <form action={createAction} className="space-y-3">
                <TextInput name="name" placeholder="Organization name" required />
                <ErrorBanner message={createState.error} />
                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? 'Creating…' : 'Create tenant & get an API key'}
                </Button>
              </form>
            </Card>

            <Card title="Already have an API key">
              <form action={existingAction} className="space-y-3">
                <TextInput name="apiKey" placeholder="mm_..." />
                <ErrorBanner message={existingState.error} />
                <Button type="submit" variant="secondary" disabled={isUsingExisting} className="w-full">
                  {isUsingExisting ? 'Continuing…' : 'Continue'}
                </Button>
              </form>
            </Card>
          </div>
        </details>

        <p className="text-xs text-slate-500 text-center">
          Your session is stored in an httpOnly cookie on this server only — it
          is never exposed to client-side JavaScript or visible in browser storage.
        </p>
      </div>
    </div>
  );
}
