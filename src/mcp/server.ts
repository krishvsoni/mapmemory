import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MapMemoryClient } from './api-client.js';
import { registerTools } from './tools.js';

const configSchema = z.object({
  MAPMEMORY_API_URL: z.string().url().default('http://localhost:4000'),
  MAPMEMORY_API_KEY: z.string().min(1),
  MAPMEMORY_SPACE_ID: z.string().uuid().optional(),
});

async function main(): Promise<void> {
  const config = configSchema.parse(process.env);
  const client = new MapMemoryClient({
    baseUrl: config.MAPMEMORY_API_URL.replace(/\/$/, ''),
    apiKey: config.MAPMEMORY_API_KEY,
    defaultSpaceId: config.MAPMEMORY_SPACE_ID,
  });

  const server = new McpServer({ name: 'mapmemory', version: '0.1.0' });
  registerTools(server, client);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`mapmemory-mcp failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
