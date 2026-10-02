'use client';

import { useActionState } from 'react';
import { createSpaceAction, type CreateSpaceFormState } from './actions';
import { Button } from '@/components/Button';
import { TextInput } from '@/components/TextInput';
import { ErrorBanner } from '@/components/ErrorBanner';

const initialState: CreateSpaceFormState = { error: null };

export function CreateSpaceForm() {
  const [state, formAction, isPending] = useActionState(createSpaceAction, initialState);

  return (
    <form action={formAction} className="flex gap-2 items-start">
      <div className="flex-1 space-y-2">
        <TextInput name="name" placeholder="Space name" required />
        <ErrorBanner message={state.error} />
      </div>
      <TextInput name="description" placeholder="Description (optional)" className="flex-1" />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create space'}
      </Button>
    </form>
  );
}
