import { defineConfig } from 'tsup'

// One build for every entry, so dist is cleaned once and no parallel build can delete another's output.
// check-worker.js must sit next to the bundles that start it (see src/run-check.ts). The shebang is for cli.js; in the
// other files it is a harmless first-line comment that Node and bundlers skip.
export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts', 'check-worker': 'src/check-worker.ts' },
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: { entry: { index: 'src/index.ts' } },
  banner: { js: '#!/usr/bin/env node' },
})
