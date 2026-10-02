import { env } from './config/env.js';
import { buildContainer } from './container.js';
import { buildServer } from './modules/api/server.js';

async function main(): Promise<void> {
  const container = buildContainer();
  const app = await buildServer(container);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  process.stderr.write(`failed to start server: ${String(error)}\n`);
  process.exitCode = 1;
});
