import { parseArgs } from 'node:util'
import { BenchError, loadModels, loadScreens, type ModelEntry } from './config'
import { fakeGenerate } from './fake'
import { makeGenerate } from './providers'
import { currentMonth, runBench } from './run'
import { makeStore } from './store'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const FAKE_MODELS: ModelEntry[] = ['fake-good', 'fake-buggy', 'fake-incomplete', 'fake-garbage']
  .map((id) => ({ id, provider: 'openrouter' as const, model: id, label: id, since: '2026-11' }))

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { month: { type: 'string' }, model: { type: 'string' }, fake: { type: 'boolean' }, 'summary-only': { type: 'boolean' } } })
  const month = values.month || currentMonth()
  if (!MONTH.test(month)) throw new BenchError(`--month must be YYYY-MM, not "${month}".`)
  const all = values.fake ? FAKE_MODELS : loadModels()
  const models = values.model ? all.filter((m) => m.id === values.model) : all
  if (models.length === 0) throw new BenchError(`No model with id "${values.model}". Ids: ${all.map((m) => m.id).join(', ')}`)
  const store = makeStore()
  if (!values['summary-only']) {
    const generate = values.fake ? fakeGenerate : makeGenerate({ env: process.env })
    const out = await runBench({ month, models, screens: loadScreens(), generate, store, log: (l) => console.log(l) })
    console.log(`Built ${out.built}, skipped ${out.skipped}, failed ${out.failed}.`)
    if (out.built === 0 && out.skipped === 0) return 1
  }
  return 0
}

main().then((code) => process.exit(code), (e) => {
  console.error(e instanceof BenchError ? e.message : e)
  process.exit(e instanceof BenchError ? 2 : 1)
})
