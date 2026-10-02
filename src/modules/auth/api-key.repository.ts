import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { apiKeys } from '../../db/schema/tenant.schema.js';

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  revokedAt: Date | null;
}

export class ApiKeyRepository {
  constructor(private readonly db: Database) {}

  async create(tenantId: string, name: string, keyPrefix: string, keyHash: string): Promise<ApiKeyRecord> {
    const [row] = await this.db.insert(apiKeys).values({ tenantId, name, keyPrefix, keyHash }).returning();
    if (!row) throw new Error('Failed to create api key');
    return row;
  }

  async findByPrefix(keyPrefix: string): Promise<ApiKeyRecord | null> {
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, keyPrefix)).limit(1);
    return row ?? null;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }
}
