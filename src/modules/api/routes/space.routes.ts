import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';

const createSpaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export function registerSpaceRoutes(app: FastifyInstance, container: Container): void {
  app.post('/v1/spaces', async (request, reply) => {
    const tenantId = request.tenantId as string;
    const body = createSpaceSchema.parse(request.body);
    const space = await container.tenants.createSpace(tenantId, body.name, body.description);
    reply.code(201).send(space);
  });

  app.get('/v1/spaces', async (request) => {
    const tenantId = request.tenantId as string;
    return container.tenants.spaces.listByTenant(tenantId);
  });

  app.get('/v1/spaces/:spaceId', async (request) => {
    const tenantId = request.tenantId as string;
    const { spaceId } = request.params as { spaceId: string };
    const space = await container.tenants.spaces.findById(tenantId, spaceId);
    if (!space) throw new NotFoundError('Memory space');
    return space;
  });
}
