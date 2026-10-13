// Run: node gen/starter/build.mjs, which writes specs/starter/*.json for the Figma file "Starter".
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SETS } from './components.mjs'
import { overview } from './overview.mjs'

const OUT = resolve(import.meta.dirname, '../../specs/starter')
mkdirSync(OUT, { recursive: true })
for (const [name, make] of Object.entries(SETS)) writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(make(), null, 2) + '\n')
writeFileSync(resolve(OUT, 'overview.json'), JSON.stringify(overview(), null, 2) + '\n')
console.log('starter specs written')
