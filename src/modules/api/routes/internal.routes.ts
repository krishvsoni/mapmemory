import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import type { Container } from '../../../container.js';
import { env } from '../../../config/env.js';
import { UnauthorizedError } from '../../../shared/errors.js';

const developerSessionSchema = z.object({
  externalSubject: z.string().min(1),
  email: z.string().email().optional(),
});

function isTrustedCaller(provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(env.INTERNAL_INTEGRATION_SECRET);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function registerInternalRoutes(app: FastifyInstance, container: Container): void {
  app.post('/v1/internal/developer-session', async (request) => {
    if (!isTrustedCaller(request.headers['x-internal-secret'] as string | undefined)) {
      throw new UnauthorizedError('Invalid internal integration secret');
    }

    const body = developerSessionSchema.parse(request.body);
    const session = await container.developerSessions.startSession(body.externalSubject, body.email ?? null);
    return session;
  });
}
