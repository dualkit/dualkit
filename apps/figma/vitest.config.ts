import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // code.ts runs in a vm against a fake figma global (test/code.test.ts), where v8 coverage cannot see it.
    coverage: {
      provider: 'v8',
      include: ['src'],
      exclude: ['src/code.ts', 'src/messages.ts', 'src/snapshot-types.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80 },
    },
  },
})
