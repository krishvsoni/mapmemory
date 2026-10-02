'use client';

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

        <Card title="New here? Create a tenant">
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

        <p className="text-xs text-slate-500 text-center">
          Your API key is stored in an httpOnly cookie on this server only — it is never exposed to
          client-side JavaScript or visible in browser storage.
        </p>
      </div>
    </div>
  );
}
