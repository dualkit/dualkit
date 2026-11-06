import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // cli.ts only connects stdio, and check-worker.ts only calls checkMarkup inside a worker thread, which coverage does
    // not see; the server and checkMarkup are covered through the in-memory client and check-core.test.ts.
    coverage: { provider: 'v8', include: ['src'], exclude: ['src/cli.ts', 'src/check-worker.ts'], thresholds: { lines: 90, branches: 85 } },
  },
})
