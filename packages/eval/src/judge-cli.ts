import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { DEFAULT_REVIEW_MODEL, fileLedger, makeVision, type VisionModel } from '../../cli/src/review/model'
import { fileJudgeCache } from './judge/cache.js'
import { listPairs, type Against } from './judge/pairs.js'
import { shoot } from './judge/render.js'
import { headline, judgeAll, type JudgeSummary } from './judge/run.js'
import { ledgerPath, OUT, REVIEW_CAP_USD } from './review-run.js'

const USAGE = 'Usage: judge run --month YYYY-MM --against dualkit|loop [--judge-model provider:model] [--limit N] [--seed N]'
const RUNS_DIR = fileURLToPath(new URL('../../../bench/runs', import.meta.url))
const JUDGE_OUT = join(OUT, 'judge')

/** provider:model, split at the first colon so names such as "x/y:free" survive. */
export function parseJudgeModel(value: string | undefined): VisionModel {
  if (value === undefined) return DEFAULT_REVIEW_MODEL
  const at = value.indexOf(':')
  const provider = value.slice(0, at)
  const model = value.slice(at + 1)
  if (at < 0 || (provider !== 'gemini' && provider !== 'openrouter') || model.trim() === '') {
    throw new Error(`--judge-model must look like provider:model, with provider gemini or openrouter, got "${value}".`)
  }
  return { provider, model }
}

const whole = (name: string, v: string | undefined, min: number, fallback: number): number => {
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} must be a whole number of ${min} or more, got "${v}".`)
  return n
}

const row = (name: string, c: Omit<JudgeSummary, 'against' | 'byModel' | 'byScreen'>): string =>
  `${name.padEnd(28)} ${[c.dualkit, c.alone, c.tie, c.inconsistent, c.failed, c.excluded].map((n) => String(n).padStart(6)).join(' ')}`

const table = (title: string, rows: JudgeSummary['byModel']): string[] => [
  `${title.padEnd(28)} ${['wins', 'alone', 'tie', 'incons', 'failed', 'excl'].map((h) => h.padStart(6)).join(' ')}`,
  ...Object.entries(rows).sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => row(k, c)),
]

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  if (command !== 'run') throw new Error(USAGE)
  const { values } = parseArgs({ args: rest, options: { month: { type: 'string' }, against: { type: 'string' }, 'judge-model': { type: 'string' }, limit: { type: 'string' }, seed: { type: 'string' } } })
  const month = values.month
  const against = values.against
  if (!month || !/^\d{4}-\d{2}$/.test(month) || (against !== 'dualkit' && against !== 'loop')) throw new Error(USAGE)
  const model = parseJudgeModel(values['judge-model'])
  const limit = whole('limit', values.limit, 1, Infinity)
  const seed = whole('seed', values.seed, 0, 1)

  const pairs = listPairs(RUNS_DIR, month, against as Against).slice(0, limit)
  if (pairs.length === 0) throw new Error(`No ${against} pairs found for ${month}.`)
  const ledger = fileLedger(ledgerPath(), REVIEW_CAP_USD)
  const vision = makeVision({ env: process.env, ledger })
  const browser = await chromium.launch()
  const shots = join(JUDGE_OUT, 'shots')
  try {
    const { results, summary, spentUsd } = await judgeAll({
      pairs, seed, modelId: `${model.provider}:${model.model}`, log: console.log,
      ask: (a) => vision(model, a),
      shootFn: (p) => shoot(p, browser, shots),
      cache: fileJudgeCache(join(JUDGE_OUT, 'cache')),
    })
    mkdirSync(JUDGE_OUT, { recursive: true })
    writeFileSync(join(JUDGE_OUT, `${month}-${against}.json`), JSON.stringify({ model, seed, summary, results }, null, 2))
    console.log(`\n${headline(summary)}${against === 'loop' ? ' (loop page counts as Dualkit)' : ''}`)
    console.log(['', ...table('model', summary.byModel), '', ...table('screen', summary.byScreen)].join('\n'))
    console.log(`\nSpent $${spentUsd.toFixed(2)} on this run, $${ledger.spent().toFixed(2)} of $${REVIEW_CAP_USD.toFixed(2)} this month`)
  } finally {
    await browser.close()
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
