import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { ValidationError } from '../../../shared/errors.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';
import { API_KEY_ROLES, type ApiKeyRole } from '../../auth/auth.types.js';

const issueKeySchema = z.object({
  name: z.string().min(1),
  role: z.enum(API_KEY_ROLES as [string, ...string[]]).default('member'),
  scopedSpaceId: z.string().uuid().optional(),
});

export function registerApiKeyRoutes(app: FastifyInstance, container: Container): void {
  const guard = { preHandler: [requireRole('admin'), forbidScopedKeys] };

  app.post('/v1/api-keys', guard, async (request, reply) => {
    const tenantId = request.tenantId as string;
    const body = issueKeySchema.parse(request.body);

    if (body.scopedSpaceId) {
      const space = await container.tenants.spaces.findById(tenantId, body.scopedSpaceId);
      if (!space) throw new ValidationError('scopedSpaceId does not belong to this tenant');
    }

    const issued = await container.apiKeys.issue(
      tenantId,
      body.name,
      body.role as ApiKeyRole,
      body.scopedSpaceId ?? null,
    );
    await container.auditLog.record({
      tenantId,
      actorApiKeyId: request.apiKeyId ?? null,
      eventType: 'api_key.issued',
      resourceType: 'api_key',
      resourceId: issued.id,
      metadata: { name: body.name, role: body.role, scopedSpaceId: body.scopedSpaceId ?? null },
    });

    reply.code(201).send(issued);
  });

  app.get('/v1/api-keys', guard, async (request) => {
    const tenantId = request.tenantId as string;
    return { apiKeys: await container.apiKeys.list(tenantId) };
  });

  app.delete('/v1/api-keys/:apiKeyId', guard, async (request) => {
    const tenantId = request.tenantId as string;
    const { apiKeyId } = request.params as { apiKeyId: string };

    await container.apiKeys.revoke(tenantId, apiKeyId);
    await container.auditLog.record({
      tenantId,
      actorApiKeyId: request.apiKeyId ?? null,
      eventType: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: apiKeyId,
    });

    return { revoked: true };
  });
}
