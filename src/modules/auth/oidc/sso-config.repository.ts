import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { ssoConfigs } from '../../../db/schema/identity.schema.js';

export interface SsoConfigRecord {
  id: string;
  tenantId: string;
  issuer: string;
  audience: string;
  jwksUri: string | null;
  defaultRole: string;
  enabled: boolean;
}

export class SsoConfigRepository {
  constructor(private readonly db: Database) {}

  async upsert(
    tenantId: string,
    issuer: string,
    audience: string,
    defaultRole: string,
    jwksUri: string | null,
  ): Promise<SsoConfigRecord> {
    const [row] = await this.db
      .insert(ssoConfigs)
      .values({ tenantId, issuer, audience, defaultRole, jwksUri, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: ssoConfigs.tenantId,
        set: { issuer, audience, defaultRole, jwksUri, enabled: true, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error('Failed to upsert SSO configuration');
    return row;
  }

  async findByTenant(tenantId: string): Promise<SsoConfigRecord | null> {
    const [row] = await this.db.select().from(ssoConfigs).where(eq(ssoConfigs.tenantId, tenantId)).limit(1);
    return row ?? null;
  }

  async findEnabledByIssuer(issuer: string): Promise<SsoConfigRecord[]> {
    return this.db.select().from(ssoConfigs).where(and(eq(ssoConfigs.issuer, issuer), eq(ssoConfigs.enabled, true)));
  }

  async disable(tenantId: string): Promise<void> {
    await this.db.update(ssoConfigs).set({ enabled: false, updatedAt: new Date() }).where(eq(ssoConfigs.tenantId, tenantId));
  }
}
