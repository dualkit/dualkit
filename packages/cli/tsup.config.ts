import { defineConfig } from 'tsup'

export default defineConfig({ entry: { cli: 'src/cli.ts' }, format: ['esm'], target: 'node18', clean: true, banner: { js: '#!/usr/bin/env node' } })
