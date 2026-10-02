import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../container.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';

export function registerAuditRoutes(app: FastifyInstance, container: Container): void {
  app.get(
    '/v1/audit-log',
    { preHandler: [requireRole('admin'), forbidScopedKeys] },
    async (request) => {
      const tenantId = request.tenantId as string;
      const { limit, eventType } = request.query as { limit?: string; eventType?: string };

      const entries = await container.auditLog.list(tenantId, limit ? Number(limit) : 50, eventType);
      return { entries };
    },
  );
}
