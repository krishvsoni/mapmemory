import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../../config/env.js';
import type { Container } from '../../container.js';
import { createAuthHook } from '../auth/auth.middleware.js';
import { rateLimitHook } from '../ratelimit/rate-limit.middleware.js';
import { handleError } from './error-handler.js';
import { registerTenantRoutes } from './routes/tenant.routes.js';
import { registerSpaceRoutes } from './routes/space.routes.js';
import { registerMemoryRoutes } from './routes/memory.routes.js';
import { registerGraphRoutes } from './routes/graph.routes.js';
import { registerApiKeyRoutes } from './routes/api-key.routes.js';
import { registerAuditRoutes } from './routes/audit.routes.js';
import { registerUsageRoutes } from './routes/usage.routes.js';

export async function buildServer(container: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.NODE_ENV === 'development' ? 'info' : 'warn' },
  });

  await app.register(cors, { origin: true });

  app.setErrorHandler(handleError);

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerTenantRoutes(app, container);

  const authenticate = createAuthHook(container.apiKeys);
  app.register(async (scoped) => {
    scoped.addHook('preHandler', authenticate);
    scoped.addHook('preHandler', rateLimitHook);
    registerSpaceRoutes(scoped, container);
    registerMemoryRoutes(scoped, container);
    registerGraphRoutes(scoped, container);
    registerApiKeyRoutes(scoped, container);
    registerAuditRoutes(scoped, container);
    registerUsageRoutes(scoped, container);
  });

  return app;
}
