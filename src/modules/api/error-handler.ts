import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';

export function handleError(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.code(422).send({ code: 'VALIDATION_ERROR', message: error.issues.map((i) => i.message).join('; ') });
    return;
  }

  if (error instanceof AppError) {
    reply.code(error.statusCode).send({ code: error.code, message: error.message });
    return;
  }

  request.log.error(error);
  reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
}
