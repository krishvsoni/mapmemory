import type { FastifyRequest } from 'fastify';
import type { Database } from '../../db/client.js';
import { AuditLogRepository, type AuditEntry, type NewAuditEntry } from './audit-log.repository.js';

export function actorFromRequest(request: FastifyRequest): { actorApiKeyId: string | null; actorMemberId: string | null } {
  return { actorApiKeyId: request.apiKeyId ?? null, actorMemberId: request.memberId ?? null };
}

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
