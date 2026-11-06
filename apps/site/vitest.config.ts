import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // The same @/ root as tsconfig.json, so the gulf demos find the shadcn primitives in components/ui.
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
