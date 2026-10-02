import type { FastifyReply, FastifyRequest } from 'fastify';
import { enforceRateLimit } from './rate-limiter.js';

export async function rateLimitHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.tenantId) return;
  await enforceRateLimit(request.tenantId);
}
