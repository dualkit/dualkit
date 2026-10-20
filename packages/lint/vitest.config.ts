import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: { provider: 'v8', include: ['src'], thresholds: { lines: 90, branches: 85 } },
  },
})
