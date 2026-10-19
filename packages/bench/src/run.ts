import { chromium, type Browser } from 'playwright'
import sharp from 'sharp'
import { RUN, type ModelEntry, type Screen } from './config'
import { extractHtml } from './extract'
import type { Generate } from './providers'
import { scoreHtml } from './score'
import type { BuildKey, BuildRecord, Condition, Store } from './store'
import { checkSkills, SKILLS_DIR, systemPrompt } from './system'

const CONDITIONS: readonly Condition[] = ['alone', 'dualkit']
const ACCESS = /^No [A-Z_]+_API_KEY$|^HTTP (401|403|404)\b/
/** A 4xx other than 429 will not get better by asking again. */
const CLIENT = /^HTTP 4(?!29)\d\d\b/
const LOCK_AFTER = 3
type Streak = { key: string | null; n: number }

/** Access errors lock a model whatever their wording; any other 4xx only when the same error comes back each time. */
export function nextStreak(prev: Streak, error: string | null): Streak {
  const key = error === null ? null : ACCESS.test(error) ? 'access' : CLIENT.test(error) ? error : null
  if (key === null) return { key: null, n: 0 }
  return { key, n: key === prev.key ? prev.n + 1 : 1 }
}
const NO_REPLY = { reply: null, usage: null, finish: null, reasoningTokens: null, servedModel: null } as const

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7)

/** Scoring renders in Chromium twice per build; two at once keeps a CI runner responsive. */
export const SCORE_CONCURRENCY = 2

type Options = {
  month: string; models: ModelEntry[]; screens: Screen[]; generate: Generate; store: Store
  score?: typeof scoreHtml; log?: (line: string) => void; skillsDir?: string
  /** Launches the shared Chromium. Defaults to Playwright's when scoring is the real scoreHtml; without one, scoring launches its own. */
  launch?: () => Promise<Browser>
  /** Epoch ms. Once it passes no new build starts; builds already in flight finish. */
  deadline?: number
  now?: () => number
  /** Runs per model, screen and condition; fewer than RUN.runs only for a live probe. */
  runs?: number
}
type Counts = { built: number; skipped: number; failed: number; stoppedEarly: boolean }
type Limit = <T>(fn: () => Promise<T>) => Promise<T>
type Scorer = (html: string, screen: Screen) => ReturnType<typeof scoreHtml>

/** At most `size` callers run at once; a finished caller hands its slot straight to the next in line. */
export function semaphore(size: number): Limit {
  let active = 0
  const waiting: (() => void)[] = []
  return async (fn) => {
    if (active < size) active++
    else await new Promise<void>((resolve) => waiting.push(resolve))
    try {
      return await fn()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}

/** One Chromium for every build, relaunched when it has died, so a crash costs one build and not every one after it. */
function sharedBrowser(launch: () => Promise<Browser>) {
  let current: Promise<Browser> | undefined
  return {
    async get(): Promise<Browser> {
      const seen = current
      const browser = seen && (await seen.catch(() => undefined))
      if (browser?.isConnected()) return browser
      if (current === seen) {
        void browser?.close().catch(() => {})
        current = launch()
      }
      return current!
    },
    async close() {
      const browser = current && (await current.catch(() => undefined))
      await browser?.close().catch(() => {})
    },
  }
}

export async function runBench({ month, models, screens, generate, store, score = scoreHtml, log = () => {}, skillsDir = SKILLS_DIR, launch, deadline = Infinity, now = Date.now, runs = RUN.runs }: Options): Promise<Counts> {
  checkSkills(skillsDir)
  const doLaunch = launch ?? (score === scoreHtml ? () => chromium.launch() : undefined)
  const browser = doLaunch ? sharedBrowser(doLaunch) : undefined
  const limit = semaphore(SCORE_CONCURRENCY)
  const scorer: Scorer = (html, screen) => limit(async () => score(html, screen.required, browser ? { browser: await browser.get() } : {}))
  try {
    // Every model at once, sharing the one paced Generate; each model's own builds stay in order.
    const all = await Promise.all(models.map((model) => runModel({ month, model, screens, generate, store, scorer, log, skillsDir, runs, late: () => now() >= deadline })))
    return all.reduce((a, c) => ({ built: a.built + c.built, skipped: a.skipped + c.skipped, failed: a.failed + c.failed, stoppedEarly: a.stoppedEarly || c.stoppedEarly }), NONE)
  } finally {
    await browser?.close()
  }
}

type ModelRun = { month: string; model: ModelEntry; screens: Screen[]; generate: Generate; store: Store; scorer: Scorer; log: (line: string) => void; skillsDir: string; runs: number; late: () => boolean }
const NONE: Counts = { built: 0, skipped: 0, failed: 0, stoppedEarly: false }

async function runModel({ month, model, screens, generate, store, scorer, log, skillsDir, runs, late }: ModelRun): Promise<Counts> {
  let counts = NONE
  let streak: Streak = { key: null, n: 0 }
  for (const screen of screens) for (const condition of CONDITIONS) for (let run = 1; run <= runs; run++) {
    const key: BuildKey = { month, model: model.id, screen: screen.id, condition, run }
    if (store.isDone(key)) { counts = { ...counts, skipped: counts.skipped + 1 }; continue }
    if (streak.n >= LOCK_AFTER) continue
    if (late()) {
      log(`${model.id}: past the deadline, leaving the rest for the next run`)
      return { ...counts, stoppedEarly: true }
    }
    const rec = await build(key, model, screen, generate, scorer, skillsDir, log)
    streak = nextStreak(streak, rec.record.ok ? null : rec.record.error)
    store.write(rec.record, rec.html, rec.shot)
    counts = rec.record.ok ? { ...counts, built: counts.built + 1 } : { ...counts, failed: counts.failed + 1 }
    log(`${key.model} ${key.screen} ${key.condition} ${key.run}: ${rec.record.ok ? `${rec.record.rulesPassed} rules` : rec.record.error}`)
  }
  if (streak.n >= LOCK_AFTER) log(`${model.id}: skipped for this run after ${LOCK_AFTER} errors in a row that will not clear: ${streak.key}`)
  return counts
}

type Built = { record: BuildRecord; html: string | null; shot: Buffer | null }

/** The page's screenshot from the scoring render, at 1x: the summary copies this file, so the image is the build that was scored. */
const toWebp = (png: string) => sharp(Buffer.from(png, 'base64')).resize({ width: RUN.width }).webp({ quality: 90 }).toBuffer()

async function build(key: BuildKey, model: ModelEntry, screen: Screen, generate: Generate, scorer: Scorer, skillsDir: string, log: (line: string) => void): Promise<Built> {
  const base = { ...key, at: new Date().toISOString() }
  const gen = await generate(model, { system: systemPrompt(key.condition, skillsDir), prompt: screen.prompt })
  if (!gen.ok) {
    const r = gen.reply
    const reply = r ? { reply: r.text, usage: r.usage, finish: r.finish, reasoningTokens: r.reasoningTokens, servedModel: r.servedModel } : NO_REPLY
    return { record: { ...base, ...reply, ms: gen.ms, ok: false, error: gen.error }, html: null, shot: null }
  }
  const meta = { ...base, reply: gen.text, usage: gen.usage, ms: gen.ms, finish: gen.finish, reasoningTokens: gen.reasoningTokens, servedModel: gen.servedModel }
  const html = extractHtml(gen.text)
  if (html === null) return { record: { ...meta, ok: false, error: 'No HTML in the reply' }, html: null, shot: null }
  try {
    const s = await scorer(html, screen)
    if (!s.ok) return { record: { ...meta, ok: false, error: `Render failed: ${s.error}` }, html, shot: null }
    const shot = await toWebp(s.screenshot).catch((e: unknown) => {
      log(`${key.model} ${key.screen} ${key.condition} ${key.run}: screenshot not saved: ${e instanceof Error ? e.message : String(e)}`)
      return null
    })
    const record: BuildRecord = {
      ...meta, ok: true, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, findings: s.findings,
      unreadableStylesheets: s.unreadableStylesheets, pageHeight: s.pageHeight,
    }
    return { record, html, shot }
  } catch (e) {
    return { record: { ...meta, ok: false, error: `Render failed: ${e instanceof Error ? e.message : String(e)}` }, html, shot: null }
  }
}
