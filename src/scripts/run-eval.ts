import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { db, pool } from '../db/client.js';
import { buildContainer } from '../container.js';
import { getRedisConnection } from '../modules/queue/redis-connection.js';
import { loadLocomo } from '../modules/eval/datasets/locomo.loader.js';
import { loadLongMemEval } from '../modules/eval/datasets/longmemeval.loader.js';
import { PostgresEvalSandbox } from '../modules/eval/eval-sandbox.js';
import { runEval } from '../modules/eval/eval.runner.js';
import type { EvalDataset, RetrievalMode } from '../modules/eval/eval.types.js';
import { summarizeByMode } from '../modules/eval/metrics.js';
import { formatReport } from '../modules/eval/report.js';
import { DEFAULT_CHUNK_CHARS } from '../modules/eval/session-chunker.js';

const USAGE =
  'usage: npm run eval -- --dataset locomo|longmemeval --file <path> [--modes hybrid,vector] ' +
  '[--limit-conversations n] [--limit-questions n] [--chunk-chars n] [--answer-model id] [--judge-model id] ' +
  '[--include-adversarial] [--keep] [--out report.json]';

function parseModes(raw: string): RetrievalMode[] {
  const modes = raw.split(',').map((m) => m.trim());
  for (const mode of modes) {
    if (mode !== 'hybrid' && mode !== 'vector') throw new Error(`unknown mode "${mode}"`);
  }
  return modes as RetrievalMode[];
}

function optionalInt(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number.parseInt(value, 10);
}

function loadDataset(kind: string, file: string, includeAdversarial: boolean): EvalDataset {
  const raw = JSON.parse(readFileSync(file, 'utf-8')) as unknown;
  if (kind === 'locomo') return { name: 'LoCoMo', conversations: loadLocomo(raw, { includeAdversarial }) };
  if (kind === 'longmemeval') return { name: 'LongMemEval', conversations: loadLongMemEval(raw) };
  throw new Error(`unknown dataset "${kind}"`);
}

async function run(): Promise<void> {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string' },
      file: { type: 'string' },
      modes: { type: 'string', default: 'hybrid,vector' },
      'limit-conversations': { type: 'string' },
      'limit-questions': { type: 'string' },
      'chunk-chars': { type: 'string' },
      'answer-model': { type: 'string' },
      'judge-model': { type: 'string' },
      'include-adversarial': { type: 'boolean', default: false },
      keep: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  });
  if (!values.dataset || !values.file) throw new Error(USAGE);

  const container = buildContainer();
  const sandbox = new PostgresEvalSandbox(db, container.tenants, values.keep ?? false);
  const dataset = loadDataset(values.dataset, values.file, values['include-adversarial'] ?? false);

  try {
    const outcomes = await runEval(
      {
        consolidation: container.consolidation,
        retrieval: container.retrieval,
        graph: container.graph,
        llm: container.llm,
        sandbox,
      },
      dataset,
      {
        modes: parseModes(values.modes ?? 'hybrid,vector'),
        chunkChars: optionalInt(values['chunk-chars']) ?? DEFAULT_CHUNK_CHARS,
        limitConversations: optionalInt(values['limit-conversations']),
        limitQuestions: optionalInt(values['limit-questions']),
        answerModel: values['answer-model'],
        judgeModel: values['judge-model'],
        log: (message) => process.stdout.write(`${message}\n`),
      },
    );

    const summaries = summarizeByMode(outcomes);
    process.stdout.write(`\n${formatReport(dataset.name, summaries)}\n`);
    if (values.out) writeFileSync(values.out, JSON.stringify({ dataset: dataset.name, summaries, outcomes }, null, 2));
  } finally {
    await sandbox.dispose();
  }
}

run()
  .catch((error: unknown) => {
    process.stderr.write(`eval failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    getRedisConnection().disconnect();
  });
