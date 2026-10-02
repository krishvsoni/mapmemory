import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { tenants } from '../../db/schema/tenant.schema.js';

export interface Tenant {
  id: string;
  name: string;
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
}

export class TenantRepository {
  constructor(private readonly db: Database) {}

  async create(name: string, plan = 'free'): Promise<Tenant> {
    const [row] = await this.db.insert(tenants).values({ name, plan }).returning();
    if (!row) throw new Error('Failed to create tenant');
    return row;
  }

  async findById(id: string): Promise<Tenant | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return row ?? null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Tenant | null> {
    const [row] = await this.db.select().from(tenants).where(eq(tenants.stripeCustomerId, stripeCustomerId)).limit(1);
    return row ?? null;
  }

  async setStripeCustomerId(tenantId: string, stripeCustomerId: string): Promise<void> {
    await this.db.update(tenants).set({ stripeCustomerId }).where(eq(tenants.id, tenantId));
  }

  async updateSubscription(
    tenantId: string,
    fields: { plan: string; stripeSubscriptionId: string | null; subscriptionStatus: string | null },
  ): Promise<void> {
    await this.db
      .update(tenants)
      .set({
        plan: fields.plan,
        stripeSubscriptionId: fields.stripeSubscriptionId,
        subscriptionStatus: fields.subscriptionStatus,
      })
      .where(eq(tenants.id, tenantId));
  }
}
