import type { Database } from '../../db/client.js';
import { DeveloperAccountRepository, type DeveloperAccountRecord } from './developer-account.repository.js';
import { TenantService } from '../tenant/tenant.service.js';
import { ApiKeyService } from './api-key.service.js';

export interface DeveloperSessionResult {
  tenantId: string;
  apiKey: string;
  isNewAccount: boolean;
}

export class DeveloperSessionService {
  private readonly accounts: DeveloperAccountRepository;
  private readonly tenants: TenantService;
  private readonly apiKeys: ApiKeyService;

  constructor(db: Database) {
    this.accounts = new DeveloperAccountRepository(db);
    this.tenants = new TenantService(db);
    this.apiKeys = new ApiKeyService(db);
  }

  async startSession(externalSubject: string, email: string | null): Promise<DeveloperSessionResult> {
    const existing = await this.accounts.findBySubject(externalSubject);
    if (existing) return this.renewSession(existing);
    return this.provisionAndStart(externalSubject, email);
  }

  private async renewSession(account: DeveloperAccountRecord): Promise<DeveloperSessionResult> {
    if (account.lastSessionApiKeyId) {
      try {
        await this.apiKeys.revoke(account.tenantId, account.lastSessionApiKeyId);
      } catch {
        // a missing/already-revoked prior session key must not block issuing a new one
      }
    }

    const issued = await this.apiKeys.issue(account.tenantId, 'dashboard session', 'admin');
    await this.accounts.touchLogin(account.id, issued.id);
    return { tenantId: account.tenantId, apiKey: issued.plaintext, isNewAccount: false };
  }

  private async provisionAndStart(externalSubject: string, email: string | null): Promise<DeveloperSessionResult> {
    const workspaceName = email ?? `developer-${externalSubject.slice(0, 8)}`;
    const provisioned = await this.tenants.provision(workspaceName);
    const account = await this.accounts.create(externalSubject, email, provisioned.tenant.id);
    await this.accounts.touchLogin(account.id, provisioned.apiKey.id);
    return { tenantId: provisioned.tenant.id, apiKey: provisioned.apiKey.plaintext, isNewAccount: true };
  }
}
