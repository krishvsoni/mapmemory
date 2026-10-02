import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { apiKeys } from '../../db/schema/tenant.schema.js';
import type { ApiKeyRole } from './auth.types.js';

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  role: string;
  scopedSpaceId: string | null;
  revokedAt: Date | null;
}

export class ApiKeyRepository {
  constructor(private readonly db: Database) {}

  async create(
    tenantId: string,
    name: string,
    keyPrefix: string,
    keyHash: string,
    role: ApiKeyRole,
    scopedSpaceId: string | null,
  ): Promise<ApiKeyRecord> {
    const [row] = await this.db
      .insert(apiKeys)
      .values({ tenantId, name, keyPrefix, keyHash, role, scopedSpaceId })
      .returning();
    if (!row) throw new Error('Failed to create api key');
    return row;
  }

  async findByPrefix(keyPrefix: string): Promise<ApiKeyRecord | null> {
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, keyPrefix)).limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<ApiKeyRecord | null> {
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    return row ?? null;
  }

  async listActiveByTenant(tenantId: string): Promise<ApiKeyRecord[]> {
    return this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)));
  }

  async revoke(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }
}
