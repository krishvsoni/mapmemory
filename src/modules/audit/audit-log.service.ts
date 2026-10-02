import type { Database } from '../../db/client.js';
import { AuditLogRepository, type AuditEntry, type NewAuditEntry } from './audit-log.repository.js';

export class AuditLogService {
  private readonly repository: AuditLogRepository;

  constructor(db: Database) {
    this.repository = new AuditLogRepository(db);
  }

  async record(entry: NewAuditEntry): Promise<void> {
    try {
      await this.repository.record(entry);
    } catch {
      // the audit trail must never block the action it is recording
    }
  }

  async list(tenantId: string, limit: number, eventType?: string): Promise<AuditEntry[]> {
    return this.repository.listByTenant(tenantId, limit, eventType);
  }
}
