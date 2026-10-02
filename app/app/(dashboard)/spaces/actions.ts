'use server';

import { revalidatePath } from 'next/cache';
import { createSpace } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';

export interface CreateSpaceFormState {
  error: string | null;
}

export async function createSpaceAction(
  _prevState: CreateSpaceFormState,
  formData: FormData,
): Promise<CreateSpaceFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name) return { error: 'Space name is required' };

  try {
    await createSpace(name, description || undefined);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Failed to create space' };
  }

  revalidatePath('/spaces');
  return { error: null };
}
