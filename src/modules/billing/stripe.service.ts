import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError, NotConfiguredError, UnauthorizedError, ValidationError } from '../../shared/errors.js';
import { TenantRepository } from '../tenant/tenant.repository.js';
import type { Database } from '../../db/client.js';
import { planForPriceId, priceIdForPlan } from './plan-mapping.js';

function toAppError(error: unknown): Error {
  if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
    return new UnauthorizedError('Invalid webhook signature');
  }
  if (error instanceof Stripe.errors.StripeError) {
    return new AppError('BILLING_PROVIDER_ERROR', error.message, 502);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export class StripeService {
  private readonly tenants: TenantRepository;
  private client: Stripe | undefined;

  constructor(db: Database) {
    this.tenants = new TenantRepository(db);
  }

  isConfigured(): boolean {
    return Boolean(env.STRIPE_SECRET_KEY);
  }

  private getClient(): Stripe {
    if (!env.STRIPE_SECRET_KEY) throw new NotConfiguredError('Billing');
    this.client ??= new Stripe(env.STRIPE_SECRET_KEY);
    return this.client;
  }

  async createCheckoutSession(tenantId: string, targetPlan: string): Promise<{ url: string }> {
    try {
      return await this.createCheckoutSessionUnsafe(tenantId, targetPlan);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    try {
      return await this.createPortalSessionUnsafe(tenantId);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    try {
      await this.handleWebhookEventUnsafe(rawBody, signature);
    } catch (error) {
      throw toAppError(error);
    }
  }

  private async createCheckoutSessionUnsafe(tenantId: string, targetPlan: string): Promise<{ url: string }> {
    const priceId = priceIdForPlan(targetPlan);
    if (!priceId) throw new ValidationError(`No Stripe price configured for plan "${targetPlan}"`);
    if (!env.STRIPE_CHECKOUT_SUCCESS_URL || !env.STRIPE_CHECKOUT_CANCEL_URL) {
      throw new NotConfiguredError('Billing checkout redirect URLs');
    }

    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) throw new ValidationError('Tenant not found');

    const client = this.getClient();
    const customerId = await this.ensureCustomer(client, tenant.id, tenant.name, tenant.stripeCustomerId);

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: env.STRIPE_CHECKOUT_SUCCESS_URL,
      cancel_url: env.STRIPE_CHECKOUT_CANCEL_URL,
      metadata: { tenantId },
      subscription_data: { metadata: { tenantId } },
    });

    if (!session.url) throw new AppError('BILLING_PROVIDER_ERROR', 'Stripe did not return a checkout URL', 502);
    return { url: session.url };
  }

  private async createPortalSessionUnsafe(tenantId: string): Promise<{ url: string }> {
    if (!env.STRIPE_PORTAL_RETURN_URL) throw new NotConfiguredError('Billing portal return URL');

    const tenant = await this.tenants.findById(tenantId);
    if (!tenant?.stripeCustomerId) throw new ValidationError('Tenant has no billing account yet');

    const client = this.getClient();
    const session = await client.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: env.STRIPE_PORTAL_RETURN_URL,
    });
    return { url: session.url };
  }

  private async handleWebhookEventUnsafe(rawBody: Buffer, signature: string): Promise<void> {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new NotConfiguredError('Billing webhook');
    const client = this.getClient();
    const event = client.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(client, event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscriptionChanged(event.data.object, event.type === 'customer.subscription.deleted');
        break;
      default:
        break;
    }
  }

  private async ensureCustomer(
    client: Stripe,
    tenantId: string,
    tenantName: string,
    existingCustomerId: string | null,
  ): Promise<string> {
    if (existingCustomerId) return existingCustomerId;

    const customer = await client.customers.create({ name: tenantName, metadata: { tenantId } });
    await this.tenants.setStripeCustomerId(tenantId, customer.id);
    return customer.id;
  }

  private async onCheckoutCompleted(client: Stripe, session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId || !session.subscription || typeof session.customer !== 'string') return;

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const subscription = await client.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;

    await this.tenants.setStripeCustomerId(tenantId, session.customer);
    await this.tenants.updateSubscription(tenantId, {
      plan: priceId ? planForPriceId(priceId) : 'free',
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    });
  }

  private async onSubscriptionChanged(subscription: Stripe.Subscription, isDeleted: boolean): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const tenant = await this.tenants.findByStripeCustomerId(customerId);
    if (!tenant) return;

    const priceId = subscription.items.data[0]?.price.id;
    await this.tenants.updateSubscription(tenant.id, {
      plan: isDeleted ? 'free' : priceId ? planForPriceId(priceId) : tenant.plan,
      stripeSubscriptionId: isDeleted ? null : subscription.id,
      subscriptionStatus: subscription.status,
    });
  }
}
