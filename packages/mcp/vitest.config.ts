import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // cli.ts only connects stdio; the server it starts is covered through the in-memory client.
    coverage: { provider: 'v8', include: ['src'], exclude: ['src/cli.ts'], thresholds: { lines: 90, branches: 85 } },
  },
})
