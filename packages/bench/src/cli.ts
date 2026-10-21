import { parseCli } from './args'
import { BenchError, loadModels, loadScreens, type ModelEntry } from './config'
import { fakeGenerate } from './fake'
import { makeGenerate } from './providers'
import { resolveMonth } from './month'
import { runBench } from './run'
import { makeStore } from './store'
import { renderStudy, study } from './study'
import { publishSummary } from './summary'

const FAKE_MODELS: ModelEntry[] = ['fake-good', 'fake-buggy', 'fake-incomplete', 'fake-garbage']
  .map((id) => ({ id, provider: 'openrouter' as const, model: id, label: id, since: '2026-11', by: 'Fake', mark: 'google' }))

async function main(): Promise<number> {
  const args = parseCli(process.argv.slice(2))
  const month = resolveMonth({ month: args.month, fake: args.fake })
  // The workflow resolves the month once with this and passes it to every later step.
  if (args.printMonth) {
    console.log(month)
    return 0
  }
  const all = args.fake ? FAKE_MODELS : loadModels()
  // The study report reads what the month already has, over every model and screen; it builds nothing and writes nothing.
  if (args.study) {
    console.log(renderStudy(study(makeStore().list(month), all, loadScreens())))
    return 0
  }
  const models = args.model ? all.filter((m) => m.id === args.model) : all
  if (models.length === 0) throw new BenchError(`No model with id "${args.model}". Ids: ${all.map((m) => m.id).join(', ')}`)
  const store = makeStore()
  if (!args.summaryOnly) {
    const generate = args.fake ? fakeGenerate : makeGenerate({ env: process.env, ...(args.deadline !== undefined ? { deadline: args.deadline } : {}) })
    const screens = loadScreens().filter((s) => !args.screen || s.id === args.screen)
    const out = await runBench({
      month, models, screens, generate, store, log: (l) => console.log(l),
      ...(args.deadline !== undefined ? { deadline: args.deadline } : {}),
      ...(args.runs !== undefined ? { runs: args.runs } : {}),
    })
    console.log(`Built ${out.built}, skipped ${out.skipped}, failed ${out.failed}.${out.stoppedEarly ? ' Stopped at the deadline or the daily request budget; a rerun finishes the rest.' : ''}`)
    if (out.built === 0 && out.skipped === 0) return 1
  }
  if (args.noSummary) return 0
  // The summary always covers every model and screen (fake models under --fake), whatever --model, --screen or --runs limited.
  const published = await publishSummary({ month, models: args.fake ? FAKE_MODELS : loadModels(), screens: loadScreens(), store })
  if (!published.ok) {
    console.error(published.message)
    return 1
  }
  console.log(`Summary written to ${published.file}`)
  return 0
}

main().then((code) => process.exit(code), (e) => {
  console.error(e instanceof BenchError ? e.message : e)
  process.exit(e instanceof BenchError ? 2 : 1)
})
