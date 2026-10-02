import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import type { ApiKeyService } from './api-key.service.js';
import type { OidcAuthService } from './oidc/oidc-auth.service.js';
import type { ApiKeyRole } from './auth.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    apiKeyId?: string;
    memberId?: string;
    apiKeyRole?: ApiKeyRole;
    scopedSpaceId?: string | null;
  }
}

export function createAuthHook(apiKeyService: ApiKeyService, oidcAuthService: OidcAuthService) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();

    if (token.startsWith('mm_')) {
      const identity = await apiKeyService.verify(token);
      request.tenantId = identity.tenantId;
      request.apiKeyId = identity.apiKeyId;
      request.apiKeyRole = identity.role;
      request.scopedSpaceId = identity.scopedSpaceId;
      return;
    }

    const member = await oidcAuthService.verify(token);
    request.tenantId = member.tenantId;
    request.memberId = member.memberId;
    request.apiKeyRole = member.role;
    request.scopedSpaceId = member.scopedSpaceId;
  };
}
