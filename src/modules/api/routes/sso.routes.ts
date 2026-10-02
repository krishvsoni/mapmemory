import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';
import { API_KEY_ROLES } from '../../auth/auth.types.js';
import { actorFromRequest } from '../../audit/audit-log.service.js';

const upsertSsoSchema = z.object({
  issuer: z.string().url(),
  audience: z.string().min(1),
  jwksUri: z.string().url().optional(),
  defaultRole: z.enum(API_KEY_ROLES as [string, ...string[]]).default('member'),
});

export function registerSsoRoutes(app: FastifyInstance, container: Container): void {
  const guard = { preHandler: [requireRole('admin'), forbidScopedKeys] };

  app.post('/v1/sso/config', guard, async (request, reply) => {
    const tenantId = request.tenantId as string;
    const body = upsertSsoSchema.parse(request.body);

    const config = await container.ssoConfigs.upsert(
      tenantId,
      body.issuer,
      body.audience,
      body.defaultRole,
      body.jwksUri ?? null,
    );
    await container.auditLog.record({
      tenantId,
      ...actorFromRequest(request),
      eventType: 'sso.configured',
      resourceType: 'sso_config',
      resourceId: config.id,
      metadata: { issuer: body.issuer, audience: body.audience },
    });

    reply.code(201).send(config);
  });

  app.get('/v1/sso/config', guard, async (request) => {
    const tenantId = request.tenantId as string;
    const config = await container.ssoConfigs.findByTenant(tenantId);
    if (!config) throw new NotFoundError('SSO configuration');
    return config;
  });

  app.delete('/v1/sso/config', guard, async (request) => {
    const tenantId = request.tenantId as string;
    await container.ssoConfigs.disable(tenantId);
    await container.auditLog.record({
      tenantId,
      ...actorFromRequest(request),
      eventType: 'sso.disabled',
      resourceType: 'sso_config',
    });
    return { disabled: true };
  });
}

export function registerSsoDiscoveryRoutes(app: FastifyInstance, container: Container): void {
  app.get('/v1/sso/discover/:tenantId', async (request) => {
    const { tenantId } = request.params as { tenantId: string };
    const config = await container.ssoConfigs.findByTenant(tenantId);
    if (!config || !config.enabled) throw new NotFoundError('SSO configuration');
    return { issuer: config.issuer, audience: config.audience };
  });
}
