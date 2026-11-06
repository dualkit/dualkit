import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    // The gulf components import shadcn primitives the way an app that ran `shadcn init` has them.
    alias: { '@/components/ui': fileURLToPath(new URL('./gulf/ui', import.meta.url)) },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['scripts/tokens.mjs', 'components/**/*.{ts,tsx}', 'gulf/**/*.{ts,tsx}'],
      thresholds: { lines: 90, branches: 85 },
    },
  },
})
