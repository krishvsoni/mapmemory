import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

const jwksByUri = new Map<string, JWTVerifyGetKey>();
const jwksUriByIssuer = new Map<string, string>();

export function getJwks(jwksUri: string): JWTVerifyGetKey {
  let jwks = jwksByUri.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksByUri.set(jwksUri, jwks);
  }
  return jwks;
}

export async function resolveJwksUri(issuer: string): Promise<string> {
  const cached = jwksUriByIssuer.get(issuer);
  if (cached) return cached;

  const wellKnownUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await fetch(wellKnownUrl);
  if (!response.ok) throw new Error(`OIDC discovery failed for issuer ${issuer}`);

  const document = (await response.json()) as { jwks_uri?: string };
  if (!document.jwks_uri) throw new Error(`OIDC discovery document for ${issuer} has no jwks_uri`);

  jwksUriByIssuer.set(issuer, document.jwks_uri);
  return document.jwks_uri;
}
