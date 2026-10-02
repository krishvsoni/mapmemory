import type { FastifyInstance } from 'fastify';
import type { Container } from '../../../container.js';
import { ValidationError } from '../../../shared/errors.js';

export function registerWebhookRoutes(app: FastifyInstance, container: Container): void {
  app.post('/v1/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string') throw new ValidationError('Missing Stripe-Signature header');
    if (!request.rawBody) throw new ValidationError('Missing raw request body');

    await container.billing.handleWebhookEvent(request.rawBody, signature);
    reply.code(200).send({ received: true });
  });
}
