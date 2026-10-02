import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import type { ApiKeyService } from './api-key.service.js';
import type { ApiKeyRole } from './auth.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    apiKeyId?: string;
    apiKeyRole?: ApiKeyRole;
    scopedSpaceId?: string | null;
  }
}

export function createAuthHook(apiKeyService: ApiKeyService) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    const identity = await apiKeyService.verify(token);
    request.tenantId = identity.tenantId;
    request.apiKeyId = identity.apiKeyId;
    request.apiKeyRole = identity.role;
    request.scopedSpaceId = identity.scopedSpaceId;
  };
}
