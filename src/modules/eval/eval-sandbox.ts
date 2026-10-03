import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { tenants } from '../../db/schema/tenant.schema.js';
import type { TenantService } from '../tenant/tenant.service.js';

export interface EvalSandbox {
  createSpace(name: string): Promise<string>;
  dispose(): Promise<void>;
}

export class PostgresEvalSandbox implements EvalSandbox {
  private tenantId: string | undefined;

  constructor(
    private readonly db: Database,
    private readonly tenantService: TenantService,
    private readonly keep: boolean,
  ) {}

  async createSpace(name: string): Promise<string> {
    if (!this.tenantId) {
      const provisioned = await this.tenantService.provision(`eval-${Date.now()}`);
      this.tenantId = provisioned.tenant.id;
    }
    const space = await this.tenantService.createSpace(this.tenantId, name);
    return space.id;
  }

  async dispose(): Promise<void> {
    if (!this.tenantId || this.keep) return;
    await this.db.delete(tenants).where(eq(tenants.id, this.tenantId));
    this.tenantId = undefined;
  }
}
