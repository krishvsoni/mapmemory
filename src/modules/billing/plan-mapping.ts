import { env } from '../../config/env.js';

export function planForPriceId(priceId: string): string {
  if (env.STRIPE_PRICE_ID_PRO && priceId === env.STRIPE_PRICE_ID_PRO) return 'pro';
  if (env.STRIPE_PRICE_ID_ENTERPRISE && priceId === env.STRIPE_PRICE_ID_ENTERPRISE) return 'enterprise';
  return 'free';
}

export function priceIdForPlan(plan: string): string | undefined {
  if (plan === 'pro') return env.STRIPE_PRICE_ID_PRO;
  if (plan === 'enterprise') return env.STRIPE_PRICE_ID_ENTERPRISE;
  return undefined;
}
