import { randomUUID } from 'node:crypto';
import { getRedisConnection } from '../../queue/redis-connection.js';

const LOGIN_STATE_PREFIX = 'kinde:login-state:';
const EXCHANGE_PREFIX = 'kinde:exchange:';
const LOGIN_STATE_TTL_SECONDS = 300;
const EXCHANGE_TTL_SECONDS = 60;

export interface PendingLoginState {
  nonce: string;
  codeVerifier: string;
}

export async function storeLoginState(state: string, value: PendingLoginState): Promise<void> {
  await getRedisConnection().set(`${LOGIN_STATE_PREFIX}${state}`, JSON.stringify(value), 'EX', LOGIN_STATE_TTL_SECONDS);
}

export async function consumeLoginState(state: string): Promise<PendingLoginState | null> {
  const raw = await getRedisConnection().getdel(`${LOGIN_STATE_PREFIX}${state}`);
  return raw ? (JSON.parse(raw) as PendingLoginState) : null;
}

export interface ExchangeResult {
  apiKey: string;
  tenantName: string;
}

export async function storeExchangeResult(result: ExchangeResult): Promise<string> {
  const code = randomUUID();
  await getRedisConnection().set(`${EXCHANGE_PREFIX}${code}`, JSON.stringify(result), 'EX', EXCHANGE_TTL_SECONDS);
  return code;
}

export async function consumeExchangeResult(code: string): Promise<ExchangeResult | null> {
  const raw = await getRedisConnection().getdel(`${EXCHANGE_PREFIX}${code}`);
  return raw ? (JSON.parse(raw) as ExchangeResult) : null;
}
