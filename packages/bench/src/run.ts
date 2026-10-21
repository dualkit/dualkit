import { chromium, type Browser } from 'playwright'
import sharp from 'sharp'
import { RUN, type ModelEntry, type Screen } from './config'
import { extractHtml } from './extract'
import { loopBuild, type Built } from './loop'
import { ACCESS, type Generate } from './providers'
import { makeProgressWriter, progressOf, type RecentBuild } from './progress'
import { scoreHtml } from './score'
import type { BuildKey, BuildRecord, Condition, Store } from './store'
import { checkSkills, SKILLS_DIR, systemPrompt } from './system'

/** The two builds from the prompt; each dualkit run is followed by its loop run. */
const CONDITIONS: readonly Condition[] = ['alone', 'dualkit']
const ALL: readonly Condition[] = [...CONDITIONS, 'loop']
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
  const finished: RecentBuild[] = []
  const total = models.length * screens.length * ALL.length * runs
  const writeFile = makeProgressWriter(store.progressFile(month), log)
  const keys: BuildKey[] = models.flatMap((m) => screens.flatMap((sc) => ALL.flatMap((condition) => Array.from({ length: runs }, (_, i) => ({ month, model: m.id, screen: sc.id, condition, run: i + 1 })))))
  const countDone = () => keys.filter((k) => store.read(k) !== null).length
  // A catch-up run with nothing left to build writes no progress at all, so the file (and the commit) stays as it was.
  const quiet = keys.every((k) => store.isDone(k))
  const publish = (running: boolean) => (quiet ? Promise.resolve() : writeFile(progressOf({ month, running, total, done: countDone(), updatedAt: new Date(now()).toISOString(), finished })))
  const onFinish = (entry: RecentBuild) => { finished.push(entry); return publish(true) }
  await publish(true)
  const scorer: Scorer = (html, screen) => limit(async () => score(html, screen.required, browser ? { browser: await browser.get() } : {}))
  try {
    // Every model at once, sharing the one paced Generate; each model's own builds stay in order.
    const all = await Promise.all(models.map((model) => runModel({ month, model, screens, generate, store, scorer, log, skillsDir, runs, onFinish, late: () => now() >= deadline })))
    return all.reduce((a, c) => ({ built: a.built + c.built, skipped: a.skipped + c.skipped, failed: a.failed + c.failed, stoppedEarly: a.stoppedEarly || c.stoppedEarly }), NONE)
  } finally {
    await browser?.close()
    await publish(false)
  }
}

type ModelRun = { month: string; model: ModelEntry; screens: Screen[]; generate: Generate; store: Store; scorer: Scorer; log: (line: string) => void; skillsDir: string; runs: number; onFinish: (entry: RecentBuild) => Promise<void>; late: () => boolean }
const NONE: Counts = { built: 0, skipped: 0, failed: 0, stoppedEarly: false }

async function runModel({ month, model, screens, generate, store, scorer, log, skillsDir, runs, onFinish, late }: ModelRun): Promise<Counts> {
  let counts = NONE
  let streak: Streak = { key: null, n: 0 }
  const shoot = (key: BuildKey) => (png: string) => toWebp(png).catch((e: unknown) => {
    log(`${key.model} ${key.screen} ${key.condition} ${key.run}: screenshot not saved: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  /** Builds one key, or returns false once the deadline has passed. */
  const step = async (key: BuildKey, screen: Screen, make: () => Promise<Built | null>): Promise<boolean> => {
    if (store.isDone(key)) { counts = { ...counts, skipped: counts.skipped + 1 }; return true }
    if (streak.n >= LOCK_AFTER) return true
    if (late()) {
      log(`${model.id}: past the deadline, leaving the rest for the next run`)
      return false
    }
    const rec = await make()
    if (rec === null) return true
    streak = nextStreak(streak, rec.record.ok ? null : rec.record.error)
    store.write(rec.record, rec.html, rec.shot)
    counts = rec.record.ok ? { ...counts, built: counts.built + 1 } : { ...counts, failed: counts.failed + 1 }
    log(`${key.model} ${key.screen} ${key.condition} ${key.run}: ${rec.record.ok ? `${rec.record.rulesPassed} rules` : rec.record.error}`)
    await onFinish(recentOf(rec.record, model, screen))
    return true
  }
  for (const screen of screens) for (const condition of CONDITIONS) for (let run = 1; run <= runs; run++) {
    const key: BuildKey = { month, model: model.id, screen: screen.id, condition, run }
    if (!(await step(key, screen, () => build(key, model, screen, generate, scorer, skillsDir, shoot(key))))) return { ...counts, stoppedEarly: true }
    if (condition !== 'dualkit') continue
    const loopKey: BuildKey = { ...key, condition: 'loop' }
    if (!(await step(loopKey, screen, () => loopBuild({ key: loopKey, model, screen, generate, store, scorer, skillsDir, shoot: shoot(loopKey) })))) return { ...counts, stoppedEarly: true }
  }
  if (streak.n >= LOCK_AFTER) log(`${model.id}: skipped for this run after ${LOCK_AFTER} errors in a row that will not clear: ${streak.key}`)
  return counts
}

const recentOf = (r: BuildRecord, model: ModelEntry, screen: Screen): RecentBuild => ({
  at: r.at, model: model.id, label: model.label, by: model.by, mark: model.mark, screen: screen.id, screenTitle: screen.title, condition: r.condition,
  ok: r.ok, rulesPassed: r.ok ? r.rulesPassed : null, error: r.ok ? null : r.error,
})

/** The page's screenshot from the scoring render, at 1x: the summary copies this file, so the image is the build that was scored. */
const toWebp = (png: string) => sharp(Buffer.from(png, 'base64')).resize({ width: RUN.width }).webp({ quality: 90 }).toBuffer()

async function build(key: BuildKey, model: ModelEntry, screen: Screen, generate: Generate, scorer: Scorer, skillsDir: string, shoot: (png: string) => Promise<Buffer | null>): Promise<Built> {
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
    const shot = await shoot(s.screenshot)
    const record: BuildRecord = {
      ...meta, ok: true, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, findings: s.findings,
      unreadableStylesheets: s.unreadableStylesheets, pageHeight: s.pageHeight,
    }
    return { record, html, shot }
  } catch (e) {
    return { record: { ...meta, ok: false, error: `Render failed: ${e instanceof Error ? e.message : String(e)}` }, html, shot: null }
  }
}
