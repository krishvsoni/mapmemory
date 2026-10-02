import { db, pool } from '../db/client.js';
import { EdgeRepository } from '../modules/graph/repository/edge.repository.js';
import { RETENTION_DEFAULTS } from '../config/constants.js';

async function run(): Promise<void> {
  const edges = new EdgeRepository(db);
  const cutoff = new Date(Date.now() - RETENTION_DEFAULTS.supersededEdgeRetentionDays * 24 * 60 * 60 * 1000);
  const deletedCount = await edges.deleteSupersededOlderThan(cutoff);
  process.stdout.write(`pruned ${deletedCount} superseded edges older than ${cutoff.toISOString()}\n`);
  await pool.end();
}

run().catch((error: unknown) => {
  process.stderr.write(`prune failed: ${String(error)}\n`);
  process.exitCode = 1;
});
