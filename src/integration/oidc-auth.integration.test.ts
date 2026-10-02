import { createServer, type Server } from 'node:http';
import { Pool } from 'pg';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../db/client.js';
import { env } from '../config/env.js';
import { eq } from 'drizzle-orm';
import { tenants as tenantsTable } from '../db/schema/tenant.schema.js';
import { TenantService } from '../modules/tenant/tenant.service.js';
import { SsoConfigRepository } from '../modules/auth/oidc/sso-config.repository.js';
import { MemberRepository } from '../modules/auth/oidc/member.repository.js';
import { OidcAuthService } from '../modules/auth/oidc/oidc-auth.service.js';
import { UnauthorizedError } from '../shared/errors.js';

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const probe = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    await probe.query('SELECT 1');
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDatabaseReachable();

describe.skipIf(!dbAvailable)('OIDC SSO authentication (real Postgres, real crypto, real HTTP JWKS)', () => {
  const audience = 'mapmemory-test-client';
  let issuer: string;

  const tenants = new TenantService(db);
  const ssoConfigs = new SsoConfigRepository(db);
  const members = new MemberRepository(db);
  const oidcAuth = new OidcAuthService(db);

  let jwksServer: Server;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let tenantId: string;

  beforeAll(async () => {
    const { publicKey, privateKey: pk } = await generateKeyPair('RS256');
    privateKey = pk;
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key-1';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    jwksServer = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
    const address = jwksServer.address();
    if (!address || typeof address === 'string') throw new Error('Failed to bind test JWKS server');
    issuer = `http://127.0.0.1:${address.port}`;

    const provisioned = await tenants.provision('oidc-test-tenant');
    tenantId = provisioned.tenant.id;
    await ssoConfigs.upsert(tenantId, issuer, audience, 'member', `${issuer}/jwks`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    await pool.end();
  });

  async function signToken(overrides: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({ email: 'alice@example.com', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('alice-subject-id')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  it('verifies a valid token, creates a member on first login, and assigns the configured default role', async () => {
    const token = await signToken();
    const result = await oidcAuth.verify(token);

    expect(result.tenantId).toBe(tenantId);
    expect(result.role).toBe('member');

    const member = await members.findByExternalSubject(tenantId, 'alice-subject-id');
    expect(member).not.toBeNull();
    expect(member?.email).toBe('alice@example.com');
  });

  it('reuses the existing member and updates last login on a second verification', async () => {
    const before = await members.findByExternalSubject(tenantId, 'alice-subject-id');
    const token = await signToken();
    await oidcAuth.verify(token);
    const after = await members.findByExternalSubject(tenantId, 'alice-subject-id');

    expect(after?.id).toBe(before?.id);
    expect(after?.lastLoginAt?.getTime()).toBeGreaterThanOrEqual(before?.lastLoginAt?.getTime() ?? 0);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken();
    const badAudienceToken = await new SignJWT({ email: 'eve@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setAudience('some-other-client')
      .setSubject('eve-subject-id')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(oidcAuth.verify(badAudienceToken)).rejects.toThrow(UnauthorizedError);
    await expect(oidcAuth.verify(token)).resolves.toBeDefined();
  });

  it('rejects a token from an unregistered issuer', async () => {
    const token = await new SignJWT({ email: 'mallory@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('https://not-a-trusted-issuer.example.com')
      .setAudience(audience)
      .setSubject('mallory-subject-id')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(oidcAuth.verify(token)).rejects.toThrow(UnauthorizedError);
  });

  it('rejects an expired token', async () => {
    const expiredToken = await new SignJWT({ email: 'bob@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('bob-subject-id')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(privateKey);

    await expect(oidcAuth.verify(expiredToken)).rejects.toThrow(UnauthorizedError);
  });

  it('stops trusting the issuer once SSO is disabled for the tenant', async () => {
    await ssoConfigs.disable(tenantId);
    const token = await signToken();
    await expect(oidcAuth.verify(token)).rejects.toThrow(UnauthorizedError);
  });
});
