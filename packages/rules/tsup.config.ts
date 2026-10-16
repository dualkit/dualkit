import { defineConfig } from 'tsup'

export default defineConfig([
  { entry: { index: 'src/index.ts' }, format: ['esm', 'cjs'], dts: true, clean: true },
  // The reader runs inside the audited page, so it ships as one self-contained script.
  { entry: { reader: 'src/dom/entry.ts' }, format: ['iife'], minify: true, platform: 'browser' },
])
