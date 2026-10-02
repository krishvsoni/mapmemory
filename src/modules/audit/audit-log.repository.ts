import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { auditLog } from '../../db/schema/audit.schema.js';

export interface AuditEntry {
  id: string;
  tenantId: string;
  actorApiKeyId: string | null;
  actorMemberId: string | null;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface NewAuditEntry {
  tenantId: string;
  actorApiKeyId?: string | null;
  actorMemberId?: string | null;
  eventType: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditLogRepository {
  constructor(private readonly db: Database) {}

  async record(entry: NewAuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      tenantId: entry.tenantId,
      actorApiKeyId: entry.actorApiKeyId ?? null,
      actorMemberId: entry.actorMemberId ?? null,
      eventType: entry.eventType,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
    });
  }

  async listByTenant(tenantId: string, limit: number, eventType?: string): Promise<AuditEntry[]> {
    const condition = eventType
      ? and(eq(auditLog.tenantId, tenantId), eq(auditLog.eventType, eventType))
      : eq(auditLog.tenantId, tenantId);

    return this.db.select().from(auditLog).where(condition).orderBy(desc(auditLog.createdAt)).limit(limit);
  }
}
