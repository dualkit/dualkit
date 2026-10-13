import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    coverage: {
      provider: 'v8',
      include: ['scripts/tokens.mjs', 'components/**/*.{ts,tsx}'],
      thresholds: { lines: 90, branches: 85 },
    },
  },
})
