import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../container.js';
import { NotFoundError } from '../../../shared/errors.js';
import { forbidScopedKeys, requireRole } from '../../auth/authorize.middleware.js';

export function registerUsageRoutes(app: FastifyInstance, container: Container): void {
  app.get(
    '/v1/usage',
    { preHandler: [requireRole('admin'), forbidScopedKeys] },
    async (request) => {
      const tenantId = request.tenantId as string;
      const tenant = await container.tenants.tenants.findById(tenantId);
      if (!tenant) throw new NotFoundError('Tenant');

      const limit = container.usage.planLimit(tenant.plan);
      const [spaces, episodesThisMonth] = await Promise.all([
        container.tenants.spaces.listByTenant(tenantId),
        container.usage.currentMonthlyEpisodeCount(tenantId),
      ]);

      return {
        plan: tenant.plan,
        spaces: { used: spaces.length, limit: limit.maxSpaces },
        episodesThisMonth: { used: episodesThisMonth, limit: limit.maxEpisodesPerMonth },
      };
    },
  );
}
