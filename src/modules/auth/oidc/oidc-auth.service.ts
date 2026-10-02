import { decodeJwt, jwtVerify } from 'jose';
import type { Database } from '../../../db/client.js';
import { UnauthorizedError } from '../../../shared/errors.js';
import { isApiKeyRole, type ApiKeyRole } from '../auth.types.js';
import { SsoConfigRepository, type SsoConfigRecord } from './sso-config.repository.js';
import { MemberRepository, type MemberRecord } from './member.repository.js';
import { getJwks, resolveJwksUri } from './jwks-cache.js';

export interface AuthenticatedMember {
  tenantId: string;
  memberId: string;
  role: ApiKeyRole;
  scopedSpaceId: null;
}

function resolveRole(role: string): ApiKeyRole {
  return isApiKeyRole(role) ? role : 'readonly';
}

export class OidcAuthService {
  private readonly ssoConfigs: SsoConfigRepository;
  private readonly members: MemberRepository;

  constructor(db: Database) {
    this.ssoConfigs = new SsoConfigRepository(db);
    this.members = new MemberRepository(db);
  }

  async verify(token: string): Promise<AuthenticatedMember> {
    let issuer: string | undefined;
    try {
      issuer = decodeJwt(token).iss;
    } catch {
      throw new UnauthorizedError('Malformed token');
    }
    if (!issuer) throw new UnauthorizedError('Token is missing an issuer claim');

    const candidates = await this.ssoConfigs.findEnabledByIssuer(issuer);
    if (candidates.length === 0) throw new UnauthorizedError('No tenant trusts this token issuer');

    for (const config of candidates) {
      const verified = await this.tryVerify(token, config);
      if (verified) return verified;
    }
    throw new UnauthorizedError('Token failed verification');
  }

  private async tryVerify(token: string, config: SsoConfigRecord): Promise<AuthenticatedMember | null> {
    try {
      const jwksUri = config.jwksUri ?? (await resolveJwksUri(config.issuer));
      const jwks = getJwks(jwksUri);
      const { payload } = await jwtVerify(token, jwks, { issuer: config.issuer, audience: config.audience });

      if (!payload.sub) return null;
      const email = typeof payload.email === 'string' ? payload.email : null;
      const member = await this.upsertMember(config, payload.sub, email);

      return { tenantId: config.tenantId, memberId: member.id, role: resolveRole(member.role), scopedSpaceId: null };
    } catch {
      return null;
    }
  }

  private async upsertMember(config: SsoConfigRecord, subject: string, email: string | null): Promise<MemberRecord> {
    const existing = await this.members.findByExternalSubject(config.tenantId, subject);
    if (existing) {
      await this.members.touchLastLogin(existing.id);
      return existing;
    }
    return this.members.create(config.tenantId, subject, email, config.defaultRole);
  }
}
