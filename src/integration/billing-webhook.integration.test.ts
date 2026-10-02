import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../db/client.js';
import { env } from '../config/env.js';
import { tenants as tenantsTable } from '../db/schema/tenant.schema.js';
import { TenantService } from '../modules/tenant/tenant.service.js';
import { StripeService } from '../modules/billing/stripe.service.js';

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const probe = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000 });
    await probe.query('SELECT 1');
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDatabaseReachable();
const billingConfigured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID_PRO);

function buildSignedWebhookRequest(payload: Record<string, unknown>): { body: Buffer; signature: string } {
  const body = Buffer.from(JSON.stringify(payload), 'utf-8');
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body.toString('utf-8'),
    secret: env.STRIPE_WEBHOOK_SECRET as string,
  });
  return { body, signature };
}

describe.skipIf(!dbAvailable || !billingConfigured)(
  'Stripe billing webhook (real signature crypto, real Postgres, no live Stripe API calls)',
  () => {
    const tenants = new TenantService(db);
    const billing = new StripeService(db);
    let tenantId: string;
    let stripeCustomerId: string;

    beforeAll(async () => {
      const provisioned = await tenants.provision('billing-test-tenant');
      tenantId = provisioned.tenant.id;
      stripeCustomerId = `cus_test_${tenantId.slice(0, 8)}`;
      await db
        .update(tenantsTable)
        .set({ stripeCustomerId })
        .where(eq(tenantsTable.id, tenantId));
    });

    afterAll(async () => {
      if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
      await pool.end();
    });

    it('rejects a webhook with an invalid signature', async () => {
      const { body } = buildSignedWebhookRequest({ type: 'ping' });
      await expect(billing.handleWebhookEvent(body, 'bad-signature')).rejects.toThrow();
    });

    it('upgrades the tenant plan on customer.subscription.updated', async () => {
      const { body, signature } = buildSignedWebhookRequest({
        id: 'evt_test_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_1',
            customer: stripeCustomerId,
            status: 'active',
            items: { data: [{ price: { id: env.STRIPE_PRICE_ID_PRO } }] },
          },
        },
      });

      await billing.handleWebhookEvent(body, signature);

      const tenant = await tenants.tenants.findById(tenantId);
      expect(tenant?.plan).toBe('pro');
      expect(tenant?.subscriptionStatus).toBe('active');
      expect(tenant?.stripeSubscriptionId).toBe('sub_test_1');
    });

    it('downgrades the tenant to free on customer.subscription.deleted', async () => {
      const { body, signature } = buildSignedWebhookRequest({
        id: 'evt_test_2',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_1',
            customer: stripeCustomerId,
            status: 'canceled',
            items: { data: [{ price: { id: env.STRIPE_PRICE_ID_PRO } }] },
          },
        },
      });

      await billing.handleWebhookEvent(body, signature);

      const tenant = await tenants.tenants.findById(tenantId);
      expect(tenant?.plan).toBe('free');
      expect(tenant?.stripeSubscriptionId).toBeNull();
      expect(tenant?.subscriptionStatus).toBe('canceled');
    });

    it('ignores subscription events for a customer id that matches no tenant', async () => {
      const { body, signature } = buildSignedWebhookRequest({
        id: 'evt_test_3',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_unknown',
            customer: 'cus_does_not_exist',
            status: 'active',
            items: { data: [{ price: { id: env.STRIPE_PRICE_ID_PRO } }] },
          },
        },
      });

      await expect(billing.handleWebhookEvent(body, signature)).resolves.toBeUndefined();
    });
  },
);
