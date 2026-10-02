import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { developerAccounts } from '../../db/schema/identity.schema.js';

export interface DeveloperAccountRecord {
  id: string;
  externalSubject: string;
  email: string | null;
  tenantId: string;
  lastSessionApiKeyId: string | null;
}

export class DeveloperAccountRepository {
  constructor(private readonly db: Database) {}

  async findBySubject(externalSubject: string): Promise<DeveloperAccountRecord | null> {
    const [row] = await this.db
      .select()
      .from(developerAccounts)
      .where(eq(developerAccounts.externalSubject, externalSubject))
      .limit(1);
    return row ?? null;
  }

  async create(externalSubject: string, email: string | null, tenantId: string): Promise<DeveloperAccountRecord> {
    const [row] = await this.db.insert(developerAccounts).values({ externalSubject, email, tenantId }).returning();
    if (!row) throw new Error('Failed to create developer account');
    return row;
  }

  async touchLogin(id: string, sessionApiKeyId: string): Promise<void> {
    await this.db
      .update(developerAccounts)
      .set({ lastLoginAt: new Date(), lastSessionApiKeyId: sessionApiKeyId })
      .where(eq(developerAccounts.id, id));
  }
}
