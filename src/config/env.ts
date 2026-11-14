import 'dotenv/config';
import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  DATABASE_READ_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),

  LLM_PROVIDER: z.enum(['openrouter', 'openai']).default('openrouter'),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_CHAT_MODEL: z.string().default('openai/gpt-4o-mini'),
  OPENROUTER_ESCALATION_CHAT_MODEL: z.string().optional(),
  OPENROUTER_EMBED_MODEL: z.string().default('openai/text-embedding-3-small'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_ESCALATION_CHAT_MODEL: z.string().optional(),
  OPENAI_EMBED_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  AUTH_JWT_SECRET: z.string().min(16),
  API_KEY_PEPPER: z.string().min(16),
  INTERNAL_INTEGRATION_SECRET: z.string().min(16),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  REFLECTION_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  LLM_GLOBAL_MAX_CONCURRENT: z.coerce.number().int().positive().default(20),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
  STRIPE_PRICE_ID_ENTERPRISE: z.string().optional(),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().url().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().url().optional(),

  DASHBOARD_URL: z.string().url().default('http://localhost:3000'),
  KINDE_ISSUER_URL: z.string().url().optional(),
  KINDE_CLIENT_ID: z.string().optional(),
  KINDE_CLIENT_SECRET: z.string().optional(),
  KINDE_CALLBACK_URL: z.string().url().optional(),
});

const envSchema = baseSchema.superRefine((value, ctx) => {
  const keyName = value.LLM_PROVIDER === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY';
  if (!value[keyName]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [keyName], message: `Required when LLM_PROVIDER=${value.LLM_PROVIDER}` });
  }
});

export type Env = z.infer<typeof envSchema>;

function withoutBlankValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''));
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(withoutBlankValues(process.env));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
