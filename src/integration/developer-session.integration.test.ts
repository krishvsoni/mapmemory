import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from '../db/client.js';
import { env } from '../config/env.js';
import { tenants as tenantsTable } from '../db/schema/tenant.schema.js';
import { DeveloperSessionService } from '../modules/auth/developer-session.service.js';
import { ApiKeyService } from '../modules/auth/api-key.service.js';

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

describe.skipIf(!dbAvailable)('developer session (Kinde-style auto-provisioning, real Postgres)', () => {
  const sessions = new DeveloperSessionService(db);
  const apiKeys = new ApiKeyService(db);
  const externalSubject = `kinde|test-subject-${Date.now()}`;
  let tenantId: string;

  afterAll(async () => {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    await pool.end();
  });

  it('provisions a fresh tenant and issues an admin key on first login', async () => {
    const result = await sessions.startSession(externalSubject, 'dev@example.com');

    expect(result.isNewAccount).toBe(true);
    expect(result.apiKey).toMatch(/^mm_/);
    tenantId = result.tenantId;

    const keys = await apiKeys.list(tenantId);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.role).toBe('admin');
  });

  it('reuses the same tenant and rotates the session key on a second login', async () => {
    const first = await sessions.startSession(externalSubject, 'dev@example.com');
    const second = await sessions.startSession(externalSubject, 'dev@example.com');

    expect(second.isNewAccount).toBe(false);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.apiKey).not.toBe(first.apiKey);

    const keys = await apiKeys.list(second.tenantId);
    const sessionKeys = keys.filter((k) => k.name === 'dashboard session');
    expect(sessionKeys).toHaveLength(1);
  });

  it('keeps separate developer accounts (and tenants) for different external subjects', async () => {
    const otherSubject = `kinde|test-subject-${Date.now()}-other`;
    const result = await sessions.startSession(otherSubject, 'other@example.com');

    expect(result.tenantId).not.toBe(tenantId);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, result.tenantId));
  });
});
