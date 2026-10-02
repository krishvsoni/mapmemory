import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';

const createTenantSchema = z.object({
  name: z.string().min(1),
  plan: z.string().optional(),
});

export function registerTenantRoutes(app: FastifyInstance, container: Container): void {
  app.post('/v1/tenants', async (request, reply) => {
    const body = createTenantSchema.parse(request.body);
    const result = await container.tenants.provision(body.name, body.plan);

    await container.auditLog.record({
      tenantId: result.tenant.id,
      actorApiKeyId: null,
      eventType: 'tenant.provisioned',
      resourceType: 'tenant',
      resourceId: result.tenant.id,
      metadata: { name: result.tenant.name, plan: result.tenant.plan },
    });

    reply.code(201).send({
      tenantId: result.tenant.id,
      name: result.tenant.name,
      plan: result.tenant.plan,
      apiKey: result.apiKey.plaintext,
    });
  });
}
