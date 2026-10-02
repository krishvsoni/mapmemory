import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(here, 'sql');

async function run(): Promise<void> {
  const files = readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const statement = readFileSync(join(sqlDir, file), 'utf-8');
    process.stdout.write(`applying ${file}\n`);
    await pool.query(statement);
  }
  await pool.end();
}

run()
  .then(() => {
    process.stdout.write('database migration complete\n');
  })
  .catch((error: unknown) => {
    process.stderr.write(`migration failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
