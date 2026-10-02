'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discoverTenantSso,
  getOidcConfig,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from '@/lib/enterprise-sso';
import { ApiError } from '@/lib/api';
import { ENTERPRISE_STATE_COOKIE } from './constants';

export interface EnterpriseLoginFormState {
  error: string | null;
}

export async function startEnterpriseLoginAction(
  _prevState: EnterpriseLoginFormState,
  formData: FormData,
): Promise<EnterpriseLoginFormState> {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  if (!tenantId) return { error: 'Tenant ID is required' };

  let sso;
  try {
    sso = await discoverTenantSso(tenantId);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return { error: 'This tenant has no SSO configured' };
    }
    return { error: 'Could not look up SSO configuration for that tenant' };
  }

  let authUrl: URL;
  let state: string;
  let nonce: string;
  let codeVerifier: string;
  try {
    const config = await getOidcConfig(sso.issuer, sso.audience);
    state = randomState();
    nonce = randomNonce();
    codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    const dashboardUrl = process.env.MAPMEMORY_DASHBOARD_URL ?? 'http://localhost:3000';
    authUrl = buildAuthorizationUrl(config, {
      redirect_uri: `${dashboardUrl}/login/enterprise/callback`,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  } catch {
    return { error: "Could not reach this tenant's identity provider" };
  }

  const store = await cookies();
  store.set(
    ENTERPRISE_STATE_COOKIE,
    JSON.stringify({ issuer: sso.issuer, audience: sso.audience, state, nonce, codeVerifier }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/login/enterprise',
      maxAge: 300,
    },
  );

  redirect(authUrl.toString());
}
