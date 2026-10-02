import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../shared/errors.js';
import type { ApiKeyRole } from './auth.types.js';

export function requireRole(...allowed: ApiKeyRole[]) {
  return async function checkRole(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const role = request.apiKeyRole;
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenError(`This action requires one of: ${allowed.join(', ')}`);
    }
  };
}

export function requireSpaceScope(paramName = 'spaceId') {
  return async function checkSpaceScope(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const scopedSpaceId = request.scopedSpaceId;
    if (!scopedSpaceId) return;

    const params = request.params as Record<string, string | undefined>;
    if (params[paramName] !== scopedSpaceId) {
      throw new ForbiddenError('This API key is scoped to a different memory space');
    }
  };
}

export async function forbidScopedKeys(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.scopedSpaceId) {
    throw new ForbiddenError('This API key is scoped to a single memory space and cannot access tenant-wide routes');
  }
}
