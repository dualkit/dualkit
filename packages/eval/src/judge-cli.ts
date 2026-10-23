import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { DEFAULT_REVIEW_MODEL, fileLedger, makeVision, type VisionModel } from '../../cli/src/review/model'
import { writeFileAtomic } from './judge/atomic.js'
import { fileJudgeCache } from './judge/cache.js'
import { agreement, makeKey, parseAnswers, pickCalibration, skipOnError, type Key } from './judge/calibrate.js'
import { calibrationPage } from './judge/calibrate-page.js'
import { loadChecklist } from './judge/checklist.js'
import type { Winner } from './judge/judge.js'
import { listPairs, type Against, type Pair } from './judge/pairs.js'
import { isBlank, shoot } from './judge/render.js'
import { headline, judgeAll, summarize, type JudgedPair, type JudgeSummary } from './judge/run.js'
import { ledgerPath, OUT, REVIEW_CAP_USD } from './review-run.js'

const USAGE = 'Usage: judge run --month YYYY-MM --against dualkit|loop [--judge-model provider:model] [--limit N] [--seed N]'
const RUNS_DIR = fileURLToPath(new URL('../../../bench/runs', import.meta.url))
const JUDGE_OUT = join(OUT, 'judge')
const CAL_OUT = join(OUT, 'calibration')
const CAL_USAGE = 'Usage: judge calibrate make --month YYYY-MM | judge calibrate score --answers <file> [--judge-model provider:model]'

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
  `${name.padEnd(28)} ${[c.dualkit, c.alone, c.tie, c.inconsistent, c.failed, c.excluded, c.byDefault].map((n) => String(n).padStart(6)).join(' ')}`

const table = (title: string, rows: JudgeSummary['byModel']): string[] => [
  `${title.padEnd(28)} ${['wins', 'alone', 'tie', 'incons', 'failed', 'excl', 'dflt'].map((h) => h.padStart(6)).join(' ')}`,
  ...Object.entries(rows).sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => row(k, c)),
]

async function calibrateMake(rest: string[]): Promise<void> {
  const { values } = parseArgs({ args: rest, options: { month: { type: 'string' } } })
  if (!values.month || !/^\d{4}-\d{2}$/.test(values.month)) throw new Error(CAL_USAGE)
  const browser = await chromium.launch()
  try {
    const shots = join(JUDGE_OUT, 'shots')
    const png = (p: string) => shoot(p, browser, shots)
    const isBlankPair = skipOnError(async (p: Pair) => (await Promise.all([png(p.aloneHtml), png(p.otherHtml)])).some(isBlank), console.error)
    const picked = await pickCalibration(listPairs(RUNS_DIR, values.month, 'dualkit'), isBlankPair)
    const key = makeKey(picked)
    const items = await Promise.all(picked.map(async (p, i) => {
      const [alone, other] = await Promise.all([png(p.aloneHtml), png(p.otherHtml)])
      const leftIsAlone = (key[i] as Key[number]).leftIs === 'alone'
      return { slot: i + 1, left: leftIsAlone ? alone : other, right: leftIsAlone ? other : alone, checklist: loadChecklist(p.screen) }
    }))
    mkdirSync(CAL_OUT, { recursive: true })
    writeFileSync(join(CAL_OUT, 'key.json'), JSON.stringify(key, null, 2))
    writeFileSync(join(CAL_OUT, 'index.html'), calibrationPage(items))
    console.log(join(CAL_OUT, 'index.html'))
  } finally {
    await browser.close()
  }
}

async function calibrateScore(rest: string[]): Promise<void> {
  const { values } = parseArgs({ args: rest, options: { answers: { type: 'string' }, 'judge-model': { type: 'string' } } })
  if (!values.answers) throw new Error(CAL_USAGE)
  const model = parseJudgeModel(values['judge-model'])
  const key = JSON.parse(readFileSync(join(CAL_OUT, 'key.json'), 'utf8')) as Key
  const given = JSON.parse(readFileSync(values.answers, 'utf8')) as { note?: string }
  const answers = parseAnswers(given, key)
  const months = [...new Set(key.map((k) => k.pairId.split('/')[0] as string))]
  const all = months.flatMap((m) => listPairs(RUNS_DIR, m, 'dualkit'))
  const pairs = key.map((k) => {
    const p = all.find((x) => x.id === k.pairId)
    if (!p) throw new Error(`Pair ${k.pairId} from key.json is no longer in bench/runs.`)
    return p
  })
  const ledger = fileLedger(ledgerPath(), REVIEW_CAP_USD)
  const vision = makeVision({ env: process.env, ledger })
  const browser = await chromium.launch()
  try {
    const shots = join(JUDGE_OUT, 'shots')
    const { results, spentUsd } = await judgeAll({
      pairs, seed: 1, modelId: `${model.provider}:${model.model}`, log: console.log,
      ask: (a) => vision(model, a),
      shootFn: (p) => shoot(p, browser, shots),
      cache: fileJudgeCache(join(JUDGE_OUT, 'cache')),
    })
    const judged = Object.fromEntries(results.map((r) => [r.id, r.winner === 'excluded' ? 'failed' : r.winner])) as Record<string, Winner>
    const out = agreement(key, answers, judged)
    console.log(`Judge agrees with Sam on ${out.agree} of ${out.total}${out.passed ? ' (passes)' : ' (does not pass)'}`)
    for (const r of out.rows.filter((x) => !x.agrees)) {
      const k = key.find((x) => x.slot === r.slot) as Key[number]
      console.log(`  slot ${r.slot} ${r.pairId}: Sam ${r.sam} (left was ${k.leftIs}), judge ${r.judge}`)
    }
    mkdirSync(CAL_OUT, { recursive: true })
    writeFileSync(join(CAL_OUT, 'result.json'), JSON.stringify({ model, ...out, note: given.note ?? '' }, null, 2))
    console.log(`Spent $${spentUsd.toFixed(2)} on this run, $${ledger.spent().toFixed(2)} of $${REVIEW_CAP_USD.toFixed(2)} this month`)
  } finally {
    await browser.close()
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  if (command === 'calibrate') {
    const [sub, ...args] = rest
    if (sub === 'make') return calibrateMake(args)
    if (sub === 'score') return calibrateScore(args)
    throw new Error(CAL_USAGE)
  }
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
  const file = join(JUDGE_OUT, `${month}-${against}.json`)
  const save = (rs: readonly JudgedPair[], partial: boolean) => {
    mkdirSync(JUDGE_OUT, { recursive: true })
    writeFileAtomic(file, JSON.stringify({ model, seed, partial, summary: summarize(against as Against, [...rs]), results: rs }, null, 2))
  }
  let latest: readonly JudgedPair[] = []
  process.on('SIGINT', () => {
    save(latest, true)
    console.error(`\nInterrupted. Saved ${latest.length} of ${pairs.length} pairs to ${file}`)
    process.exit(130)
  })
  try {
    const { results, summary, spentUsd } = await judgeAll({
      onProgress: (rs) => { latest = rs; save(rs, true) },
      pairs, seed, modelId: `${model.provider}:${model.model}`, log: console.log,
      ask: (a) => vision(model, a),
      shootFn: (p) => shoot(p, browser, shots),
      cache: fileJudgeCache(join(JUDGE_OUT, 'cache')),
    })
    save(results, false)
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
