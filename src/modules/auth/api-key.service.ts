import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from '../../db/client.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationError } from '../../shared/errors.js';
import { ApiKeyRepository, type ApiKeyRecord } from './api-key.repository.js';
import { isApiKeyRole, type ApiKeyRole } from './auth.types.js';

export interface IssuedApiKey {
  id: string;
  plaintext: string;
  role: ApiKeyRole;
  scopedSpaceId: string | null;
}

export interface AuthenticatedKey {
  apiKeyId: string;
  tenantId: string;
  role: ApiKeyRole;
  scopedSpaceId: string | null;
}

const KEY_PREFIX_BYTES = 6;
const KEY_SECRET_BYTES = 24;

function hashSecret(secret: string): string {
  return createHmac('sha256', env.API_KEY_PEPPER).update(secret).digest('hex');
}

function toRole(record: ApiKeyRecord): ApiKeyRole {
  return isApiKeyRole(record.role) ? record.role : 'readonly';
}

export class ApiKeyService {
  private readonly repository: ApiKeyRepository;

  constructor(db: Database) {
    this.repository = new ApiKeyRepository(db);
  }

  async issue(
    tenantId: string,
    name: string,
    role: ApiKeyRole = 'admin',
    scopedSpaceId: string | null = null,
  ): Promise<IssuedApiKey> {
    const prefix = randomBytes(KEY_PREFIX_BYTES).toString('hex');
    const secret = randomBytes(KEY_SECRET_BYTES).toString('hex');
    const record = await this.repository.create(tenantId, name, prefix, hashSecret(secret), role, scopedSpaceId);
    return { id: record.id, plaintext: `mm_${prefix}_${secret}`, role, scopedSpaceId };
  }

  async list(tenantId: string): Promise<Array<Omit<ApiKeyRecord, 'keyHash'>>> {
    const records = await this.repository.listActiveByTenant(tenantId);
    return records.map(({ keyHash: _keyHash, ...rest }) => rest);
  }

  async revoke(tenantId: string, apiKeyId: string): Promise<void> {
    const record = await this.repository.findById(apiKeyId);
    if (!record || record.tenantId !== tenantId) {
      throw new ValidationError('API key not found for this tenant');
    }
    await this.repository.revoke(apiKeyId);
  }

  async verify(plaintext: string): Promise<AuthenticatedKey> {
    const parts = plaintext.split('_');
    if (parts.length !== 3 || parts[0] !== 'mm') {
      throw new UnauthorizedError('Malformed API key');
    }
    const [, prefix, secret] = parts as [string, string, string];

    const record = await this.repository.findByPrefix(prefix);
    if (!record || record.revokedAt) {
      throw new UnauthorizedError('Invalid API key');
    }

    const expected = Buffer.from(record.keyHash, 'hex');
    const actual = Buffer.from(hashSecret(secret), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedError('Invalid API key');
    }

    await this.repository.touchLastUsed(record.id);
    return {
      apiKeyId: record.id,
      tenantId: record.tenantId,
      role: toRole(record),
      scopedSpaceId: record.scopedSpaceId,
    };
  }
}
