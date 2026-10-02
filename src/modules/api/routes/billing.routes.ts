import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';

const checkoutSchema = z.object({ plan: z.enum(['pro', 'enterprise']) });

export function registerBillingRoutes(app: FastifyInstance, container: Container): void {
  const guard = { preHandler: [requireRole('admin'), forbidScopedKeys] };

  app.post('/v1/billing/checkout-session', guard, async (request) => {
    const tenantId = request.tenantId as string;
    const body = checkoutSchema.parse(request.body);
    return container.billing.createCheckoutSession(tenantId, body.plan);
  });

  app.post('/v1/billing/portal-session', guard, async (request) => {
    const tenantId = request.tenantId as string;
    return container.billing.createPortalSession(tenantId);
  });
}
