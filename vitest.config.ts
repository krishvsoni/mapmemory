import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share real Postgres/Redis state and exercise cluster-wide limits, so files can't run concurrently against that shared infrastructure.
    fileParallelism: false,
  },
});
