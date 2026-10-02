import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';
import { forbidScopedKeys, requireRole, requireSpaceScope } from '../../auth/authorize.middleware.js';
import { actorFromRequest } from '../../audit/audit-log.service.js';

const createSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export function registerSpaceRoutes(app: FastifyInstance, container: Container): void {
  app.post(
    '/v1/spaces',
    { preHandler: [requireRole('admin'), forbidScopedKeys] },
    async (request, reply) => {
      const tenantId = request.tenantId as string;
      const body = createSpaceSchema.parse(request.body);

      const tenant = await container.tenants.tenants.findById(tenantId);
      await container.usage.assertCanCreateSpace(tenantId, tenant?.plan ?? 'free');

      const space = await container.tenants.createSpace(tenantId, body.name, body.description);
      await container.auditLog.record({
        tenantId,
        ...actorFromRequest(request),
        eventType: 'space.created',
        resourceType: 'memory_space',
        resourceId: space.id,
        metadata: { name: space.name },
      });

      reply.code(201).send(space);
    },
  );

  app.get('/v1/spaces', { preHandler: [forbidScopedKeys] }, async (request) => {
    const tenantId = request.tenantId as string;
    return container.tenants.spaces.listByTenant(tenantId);
  });

  app.get('/v1/spaces/:spaceId', { preHandler: [requireSpaceScope()] }, async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');
    return space;
  });
}
