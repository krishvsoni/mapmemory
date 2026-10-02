import 'server-only';
import {
  discovery,
  None,
  allowInsecureRequests,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  randomNonce,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  type Configuration,
} from 'openid-client';
import { apiFetch } from './api';

export interface TenantSsoInfo {
  issuer: string;
  audience: string;
}

export function discoverTenantSso(tenantId: string): Promise<TenantSsoInfo> {
  return apiFetch<TenantSsoInfo>(`/v1/sso/discover/${tenantId}`, { skipAuth: true });
}

// Enterprise IdPs are integrated as public (PKCE-only) clients — the tenant's configured `audience` is our client_id; no client secret is stored per customer.
// HTTPS is enforced for the issuer in production; non-production allows plain HTTP so a local/dev IdP (e.g. Keycloak on localhost) can be tested.
export function getOidcConfig(issuer: string, audience: string): Promise<Configuration> {
  const isInsecureDevIssuer = new URL(issuer).protocol === 'http:' && process.env.NODE_ENV !== 'production';
  return discovery(
    new URL(issuer),
    audience,
    undefined,
    None(),
    isInsecureDevIssuer ? { execute: [allowInsecureRequests] } : undefined,
  );
}

export {
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  randomNonce,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
};
