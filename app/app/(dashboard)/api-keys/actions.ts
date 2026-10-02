'use server';

import { revalidatePath } from 'next/cache';
import { issueApiKey, revokeApiKey } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import type { ApiKeyRole, IssuedApiKey } from '@/lib/types';

export interface IssueKeyFormState {
  error: string | null;
  issued: IssuedApiKey | null;
}

export async function issueApiKeyAction(
  _prevState: IssueKeyFormState,
  formData: FormData,
): Promise<IssueKeyFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? 'member') as ApiKeyRole;
  const scopedSpaceId = String(formData.get('scopedSpaceId') ?? '').trim();

  if (!name) return { error: 'Key name is required', issued: null };

  try {
    const issued = await issueApiKey(name, role, scopedSpaceId || undefined);
    revalidatePath('/api-keys');
    return { error: null, issued };
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Failed to issue key', issued: null };
  }
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<void> {
  await revokeApiKey(apiKeyId);
  revalidatePath('/api-keys');
}
