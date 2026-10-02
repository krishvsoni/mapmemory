import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';
import { API_KEY_ROLES } from '../../auth/auth.types.js';
import { actorFromRequest } from '../../audit/audit-log.service.js';

const updateRoleSchema = z.object({
  role: z.enum(API_KEY_ROLES as [string, ...string[]]),
});

export function registerMemberRoutes(app: FastifyInstance, container: Container): void {
  const guard = { preHandler: [requireRole('admin'), forbidScopedKeys] };

  app.get('/v1/members', guard, async (request) => {
    const tenantId = request.tenantId as string;
    return { members: await container.members.listByTenant(tenantId) };
  });

  app.patch('/v1/members/:memberId', guard, async (request) => {
    const tenantId = request.tenantId as string;
    const { memberId } = request.params as { memberId: string };
    const body = updateRoleSchema.parse(request.body);

    await container.members.updateRole(tenantId, memberId, body.role);
    await container.auditLog.record({
      tenantId,
      ...actorFromRequest(request),
      eventType: 'member.role_updated',
      resourceType: 'member',
      resourceId: memberId,
      metadata: { role: body.role },
    });

    return { updated: true };
  });

  app.delete('/v1/members/:memberId', guard, async (request) => {
    const tenantId = request.tenantId as string;
    const { memberId } = request.params as { memberId: string };

    await container.members.remove(tenantId, memberId);
    await container.auditLog.record({
      tenantId,
      ...actorFromRequest(request),
      eventType: 'member.removed',
      resourceType: 'member',
      resourceId: memberId,
    });

    return { removed: true };
  });
}
