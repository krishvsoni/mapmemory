import type { Database } from '../../db/client.js';
import { TenantRepository, type Tenant } from './tenant.repository.js';
import { SpaceRepository, type MemorySpace } from './space.repository.js';
import { ApiKeyService, type IssuedApiKey } from '../auth/api-key.service.js';

export interface ProvisionedTenant {
  tenant: Tenant;
  apiKey: IssuedApiKey;
}

export class TenantService {
  readonly tenants: TenantRepository;
  readonly spaces: SpaceRepository;
  private readonly apiKeys: ApiKeyService;

  constructor(db: Database) {
    this.tenants = new TenantRepository(db);
    this.spaces = new SpaceRepository(db);
    this.apiKeys = new ApiKeyService(db);
  }

  async provision(name: string, plan = 'free'): Promise<ProvisionedTenant> {
    const tenant = await this.tenants.create(name, plan);
    const apiKey = await this.apiKeys.issue(tenant.id, 'default');
    return { tenant, apiKey };
  }

  async createSpace(tenantId: string, name: string, description?: string): Promise<MemorySpace> {
    return this.spaces.create(tenantId, name, description);
  }
}
