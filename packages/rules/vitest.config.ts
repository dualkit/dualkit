import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The reader runs in Chromium, where v8 coverage cannot see it; its tests are behavioural.
    coverage: { provider: 'v8', include: ['src'], exclude: ['src/dom/**'], thresholds: { lines: 90, branches: 85 } },
  },
})
