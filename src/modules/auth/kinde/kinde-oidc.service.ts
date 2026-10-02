import {
  discovery,
  ClientSecretPost,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomState,
  randomNonce,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  type Configuration,
} from 'openid-client';
import { env } from '../../../config/env.js';
import { NotConfiguredError } from '../../../shared/errors.js';

interface KindeSettings {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

function readSettings(): KindeSettings {
  const { KINDE_ISSUER_URL, KINDE_CLIENT_ID, KINDE_CLIENT_SECRET, KINDE_CALLBACK_URL } = env;
  if (!KINDE_ISSUER_URL || !KINDE_CLIENT_ID || !KINDE_CLIENT_SECRET || !KINDE_CALLBACK_URL) {
    throw new NotConfiguredError('Kinde developer login');
  }
  return { issuerUrl: KINDE_ISSUER_URL, clientId: KINDE_CLIENT_ID, clientSecret: KINDE_CLIENT_SECRET, callbackUrl: KINDE_CALLBACK_URL };
}

let cachedConfig: Configuration | undefined;

async function getConfig(settings: KindeSettings): Promise<Configuration> {
  cachedConfig ??= await discovery(
    new URL(settings.issuerUrl),
    settings.clientId,
    undefined,
    ClientSecretPost(settings.clientSecret),
  );
  return cachedConfig;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export async function buildKindeAuthorizationUrl(): Promise<AuthorizationRequest> {
  const settings = readSettings();
  const config = await getConfig(settings);

  const state = randomState();
  const nonce = randomNonce();
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

  const url = buildAuthorizationUrl(config, {
    redirect_uri: settings.callbackUrl,
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { url: url.toString(), state, nonce, codeVerifier };
}

export interface KindeIdentity {
  subject: string;
  email: string | null;
}

export interface CallbackChecks {
  expectedState: string;
  expectedNonce: string;
  pkceCodeVerifier: string;
}

export async function exchangeKindeCallback(queryParams: URLSearchParams, checks: CallbackChecks): Promise<KindeIdentity> {
  const settings = readSettings();
  const config = await getConfig(settings);

  const callbackUrl = new URL(settings.callbackUrl);
  callbackUrl.search = queryParams.toString();

  const tokens = await authorizationCodeGrant(config, callbackUrl, checks);
  const claims = tokens.claims();
  if (!claims?.sub) throw new Error('Kinde did not return a subject claim');

  const email = typeof claims.email === 'string' ? claims.email : null;
  return { subject: claims.sub, email };
}
