import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from '../../db/client.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { ApiKeyRepository } from './api-key.repository.js';

export interface IssuedApiKey {
  id: string;
  plaintext: string;
}

export interface AuthenticatedKey {
  apiKeyId: string;
  tenantId: string;
}

const KEY_PREFIX_BYTES = 6;
const KEY_SECRET_BYTES = 24;

function hashSecret(secret: string): string {
  return createHmac('sha256', env.API_KEY_PEPPER).update(secret).digest('hex');
}

export class ApiKeyService {
  private readonly repository: ApiKeyRepository;

  constructor(db: Database) {
    this.repository = new ApiKeyRepository(db);
  }

  async issue(tenantId: string, name: string): Promise<IssuedApiKey> {
    const prefix = randomBytes(KEY_PREFIX_BYTES).toString('hex');
    const secret = randomBytes(KEY_SECRET_BYTES).toString('hex');
    const record = await this.repository.create(tenantId, name, prefix, hashSecret(secret));
    return { id: record.id, plaintext: `mm_${prefix}_${secret}` };
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
    return { apiKeyId: record.id, tenantId: record.tenantId };
  }
}
