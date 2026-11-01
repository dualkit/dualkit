import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runApp, type App } from './run'
import { scoreboard, summarise } from './score'

const repo = resolve(import.meta.dirname, '../../..')
const only = process.argv[2]
const apps = (JSON.parse(readFileSync(join(import.meta.dirname, '../apps.json'), 'utf8')) as App[]).filter((a) => !only || a.id === only)
if (apps.length === 0) throw new Error(`No app named ${only} in apps.json.`)

const cache = process.env.DUALKIT_PROOF_CACHE ?? join(tmpdir(), 'dualkit-proof')
const cli = join(repo, 'packages/cli/dist/cli.js')
const results = apps.map((app) => {
  const result = runApp(app, cache, cli)
  console.log(`${app.id}: ${result.outcome} strings=${result.strings} missed=${result.missed} ${result.seconds}s ${result.detail}`)
  return result
})

const date = new Date().toISOString().slice(0, 10)
const out = join(repo, 'docs/proof')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'scoreboard.md'), scoreboard(results, date))
writeFileSync(join(out, 'scoreboard.json'), `${JSON.stringify({ date, summary: summarise(results), results }, null, 2)}\n`)
console.log(summarise(results))
