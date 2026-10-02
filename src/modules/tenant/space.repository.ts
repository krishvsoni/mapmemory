import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { memorySpaces } from '../../db/schema/tenant.schema.js';

export interface MemorySpace {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
}

export class SpaceRepository {
  constructor(private readonly db: Database) {}

  async create(tenantId: string, name: string, description?: string): Promise<MemorySpace> {
    const [row] = await this.db
      .insert(memorySpaces)
      .values({ tenantId, name, description: description ?? null })
      .returning();
    if (!row) throw new Error('Failed to create memory space');
    return row;
  }

  async findById(tenantId: string, spaceId: string): Promise<MemorySpace | null> {
    const [row] = await this.db
      .select()
      .from(memorySpaces)
      .where(and(eq(memorySpaces.id, spaceId), eq(memorySpaces.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  }

  async listByTenant(tenantId: string): Promise<MemorySpace[]> {
    return this.db.select().from(memorySpaces).where(eq(memorySpaces.tenantId, tenantId));
  }
}
