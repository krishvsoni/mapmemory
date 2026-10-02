'use server';

import { redirect } from 'next/navigation';
import { provisionTenant } from '@/lib/endpoints';
import { setSession } from '@/lib/session';
import { ApiError } from '@/lib/api';

import type { LoginFormState } from './form-state';

export async function createTenantAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Organization name is required' };

  try {
    const tenant = await provisionTenant(name);
    await setSession(tenant.apiKey, tenant.name);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Failed to create tenant' };
  }
  redirect('/spaces');
}

export async function useExistingKeyAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  if (!apiKey) return { error: 'API key is required' };

  await setSession(apiKey, 'your tenant');
  redirect('/spaces');
}
