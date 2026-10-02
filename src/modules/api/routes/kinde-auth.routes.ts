import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container.js';
import { env } from '../../../config/env.js';
import { ValidationError } from '../../../shared/errors.js';
import { buildKindeAuthorizationUrl, exchangeKindeCallback } from '../../auth/kinde/kinde-oidc.service.js';
import {
  consumeExchangeResult,
  consumeLoginState,
  storeExchangeResult,
  storeLoginState,
} from '../../auth/kinde/login-state.store.js';

const exchangeSchema = z.object({ code: z.string().min(1) });

export function registerKindeAuthRoutes(app: FastifyInstance, container: Container): void {
  app.get('/v1/auth/kinde/login', async (_request, reply) => {
    const authRequest = await buildKindeAuthorizationUrl();
    await storeLoginState(authRequest.state, { nonce: authRequest.nonce, codeVerifier: authRequest.codeVerifier });
    reply.redirect(authRequest.url);
  });

  app.get('/v1/auth/kinde/callback', async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (!query.state) {
      reply.redirect(`${env.DASHBOARD_URL}/login?error=kinde_login_failed`);
      return;
    }

    const pending = await consumeLoginState(query.state);
    if (!pending) {
      reply.redirect(`${env.DASHBOARD_URL}/login?error=kinde_session_expired`);
      return;
    }

    try {
      const identity = await exchangeKindeCallback(new URLSearchParams(query), {
        expectedState: query.state,
        expectedNonce: pending.nonce,
        pkceCodeVerifier: pending.codeVerifier,
      });

      const session = await container.developerSessions.startSession(identity.subject, identity.email);
      const exchangeCode = await storeExchangeResult({
        apiKey: session.apiKey,
        tenantName: identity.email ?? 'your workspace',
      });

      reply.redirect(`${env.DASHBOARD_URL}/login/developer/complete?code=${exchangeCode}`);
    } catch {
      reply.redirect(`${env.DASHBOARD_URL}/login?error=kinde_login_failed`);
    }
  });

  app.post('/v1/auth/kinde/exchange', async (request) => {
    const body = exchangeSchema.parse(request.body);
    const result = await consumeExchangeResult(body.code);
    if (!result) throw new ValidationError('Invalid or expired exchange code');
    return result;
  });
}
