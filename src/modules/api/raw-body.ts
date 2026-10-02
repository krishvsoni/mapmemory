import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export function registerRawBodyCapture(app: FastifyInstance): void {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    request.rawBody = buffer;
    if (buffer.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(buffer.toString('utf-8')));
    } catch (error) {
      done(error as Error, undefined);
    }
  });
}
