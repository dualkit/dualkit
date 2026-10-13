import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: { provider: 'v8', include: ['scripts/tokens.mjs'], thresholds: { lines: 90, branches: 85 } },
  },
})
