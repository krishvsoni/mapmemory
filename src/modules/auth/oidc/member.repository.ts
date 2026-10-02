import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { members } from '../../../db/schema/identity.schema.js';

export interface MemberRecord {
  id: string;
  tenantId: string;
  externalSubject: string;
  email: string | null;
  role: string;
  lastLoginAt: Date | null;
}

export class MemberRepository {
  constructor(private readonly db: Database) {}

  async findByExternalSubject(tenantId: string, externalSubject: string): Promise<MemberRecord | null> {
    const [row] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.externalSubject, externalSubject)))
      .limit(1);
    return row ?? null;
  }

  async create(tenantId: string, externalSubject: string, email: string | null, role: string): Promise<MemberRecord> {
    const [row] = await this.db.insert(members).values({ tenantId, externalSubject, email, role }).returning();
    if (!row) throw new Error('Failed to create member');
    return row;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.update(members).set({ lastLoginAt: new Date() }).where(eq(members.id, id));
  }

  async listByTenant(tenantId: string): Promise<MemberRecord[]> {
    return this.db.select().from(members).where(eq(members.tenantId, tenantId));
  }

  async updateRole(tenantId: string, memberId: string, role: string): Promise<void> {
    await this.db.update(members).set({ role }).where(and(eq(members.tenantId, tenantId), eq(members.id, memberId)));
  }

  async remove(tenantId: string, memberId: string): Promise<void> {
    await this.db.delete(members).where(and(eq(members.tenantId, tenantId), eq(members.id, memberId)));
  }
}
