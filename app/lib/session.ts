import 'server-only';
import { cookies } from 'next/headers';

const API_KEY_COOKIE = 'mapmemory_api_key';
const TENANT_NAME_COOKIE = 'mapmemory_tenant_name';

const secureCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function getApiKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(API_KEY_COOKIE)?.value ?? null;
}

export async function getTenantName(): Promise<string | null> {
  const store = await cookies();
  return store.get(TENANT_NAME_COOKIE)?.value ?? null;
}

export async function setSession(apiKey: string, tenantName: string): Promise<void> {
  const store = await cookies();
  store.set(API_KEY_COOKIE, apiKey, secureCookieOptions);
  store.set(TENANT_NAME_COOKIE, tenantName, { ...secureCookieOptions, httpOnly: false });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(API_KEY_COOKIE);
  store.delete(TENANT_NAME_COOKIE);
}
