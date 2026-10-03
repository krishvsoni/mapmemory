import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MapMemoryClient } from './api-client.js';
import { formatHistory, formatRecall } from './format.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function text(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }] };
}

async function guarded(action: () => Promise<string>): Promise<ToolResult> {
  try {
    return text(await action());
  } catch (error) {
    return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true };
  }
}

const spaceId = z.string().uuid().optional().describe('Memory space id; defaults to MAPMEMORY_SPACE_ID');
const isoDateTime = z.string().datetime({ offset: true });

export function registerTools(server: McpServer, client: MapMemoryClient): void {
  server.registerTool(
    'remember',
    {
      description:
        'Store an observation, preference, decision or fact in long-term memory. Include when it happened if known.',
      inputSchema: {
        text: z.string().min(1).max(8000),
        occurredAt: isoDateTime.optional().describe('When this happened, ISO 8601 with timezone'),
        spaceId,
      },
    },
    ({ text: observation, occurredAt, spaceId: space }) =>
      guarded(async () => {
        const { jobId } = await client.remember(client.resolveSpace(space), observation, occurredAt);
        return `Queued for memory consolidation (job ${jobId}).`;
      }),
  );

  server.registerTool(
    'recall',
    {
      description:
        'Search long-term memory. Returns current facts with validity dates and confidence, plus the source passages. ' +
        'Use asOf to see what was true at a past moment, and includeHistory to also see facts that have since changed.',
      inputSchema: {
        query: z.string().min(1).max(2000),
        asOf: isoDateTime.optional(),
        includeHistory: z.boolean().optional(),
        spaceId,
      },
    },
    ({ query, asOf, includeHistory, spaceId: space }) =>
      guarded(async () => formatRecall(await client.recall(client.resolveSpace(space), query, { asOf, includeHistory }))),
  );

  server.registerTool(
    'fact_history',
    {
      description: 'Show how one fact changed over time. Pass the id shown next to a fact returned by recall.',
      inputSchema: { edgeId: z.string().uuid(), spaceId },
    },
    ({ edgeId, spaceId: space }) =>
      guarded(async () => formatHistory((await client.factHistory(client.resolveSpace(space), edgeId)).history)),
  );

  server.registerTool(
    'ingest_status',
    {
      description: 'Check whether a queued remember call has finished consolidating.',
      inputSchema: { jobId: z.string().min(1) },
    },
    ({ jobId }) =>
      guarded(async () => {
        const job = await client.job(jobId);
        return `Job ${job.jobId}: ${job.state}`;
      }),
  );
}
