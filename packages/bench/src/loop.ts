import { existsSync, readFileSync } from 'node:fs'
import type { ModelEntry, Screen } from './config'
import { extractHtml } from './extract'
import { feedbackPrompt, lintPage, MAX_ITEMS } from './feedback'
import { BUDGET_SPENT, mayClear, type Generate, type Turn, type Usage } from './providers'
import { failedRules, type Scored, type SlimFinding } from './score'
import type { BuildKey, BuildRecord, Round, RoundPage, Store } from './store'
import { SKILLS_DIR, systemPrompt } from './system'

export type { Round }
/** Fix rounds per loop build, after the dualkit build it starts from. */
export const MAX_ROUNDS = 2

export type Built = { record: BuildRecord; html: string | null; shot: Buffer | null
  /** Each fix round's rendered page, for a loop build. */
  pages?: RoundPage[] }
type Side = { failed: string[]; missing: string[]; text: string }
type OkScored = Extract<Scored, { ok: true }>
type Scorer = (html: string, screen: Screen) => Promise<Scored>
type Meta = { finish: string | null; reasoningTokens: number | null; servedModel: string | null }
/** The last page that rendered, and the turns that led to it (none for the dualkit page). */
type Page = {
  html: string
  reply: string
  turns: Turn[]
  findings: SlimFinding[]
  /** Lint rules at warning or error, so harm sees lint regressions too. */
  lintFailed: string[]
  missing: string[]
  text: string | null
  meta: Meta
  result: Pick<OkScored, 'rulesPassed' | 'score' | 'unreadableStylesheets' | 'pageHeight'>
  png: string | null
}

const ARABIC = /[ء-ي]/g
const letters = (text: string) => {
  const counts = new Map<string, number>()
  for (const c of text.match(ARABIC) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
  return counts
}
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** What a fix broke: rules that newly fail, parts that went missing, and the share of Arabic letters still there. */
export function harm(before: Side, after: Side): { regressed: string[]; lostParts: string[]; arabicKept: number } {
  const was = new Set(before.failed)
  const had = new Set(before.missing)
  const b = letters(before.text)
  const a = letters(after.text)
  let total = 0, kept = 0
  for (const [c, n] of b) { total += n; kept += Math.min(n, a.get(c) ?? 0) }
  return {
    regressed: [...new Set(after.failed)].filter((r) => !was.has(r)),
    lostParts: [...new Set(after.missing)].filter((p) => !had.has(p)),
    arabicKept: total === 0 ? 1 : Math.round((kept / total) * 1000) / 1000,
  }
}

type Input = { key: BuildKey; model: ModelEntry; screen: Screen; generate: Generate; store: Store; scorer: Scorer; skillsDir?: string
  /** Turns a page's PNG into the stored WebP. */
  shoot: (png: string) => Promise<Buffer | null>
  /** True once no new call may start (the deadline passed or the budget is spent); round 2 is then skipped and round 1 kept. */
  late?: () => boolean }

/** Sends the dualkit page's check and lint findings back for up to MAX_ROUNDS fixes. Null when there is no dualkit page to start from, so nothing is written and a rerun tries again. */
export async function loopBuild({ key, model, screen, generate, store, scorer, skillsDir = SKILLS_DIR, shoot, late = () => false }: Input): Promise<Built | null> {
  const dualkitKey: BuildKey = { ...key, condition: 'dualkit' }
  const from = store.read(dualkitKey)
  const htmlFile = store.paths(dualkitKey).html
  if (!from?.ok || from.reply === null || !existsSync(htmlFile)) return null
  const at = new Date().toISOString()
  const html = readFileSync(htmlFile, 'utf8')
  let good: Page = {
    html, reply: from.reply, turns: [], findings: from.findings, lintFailed: failedRules(lintPage(html)), missing: from.missing, text: null,
    meta: { finish: from.finish, reasoningTokens: from.reasoningTokens, servedModel: from.servedModel },
    result: { rulesPassed: from.rulesPassed, score: from.score, unreadableStylesheets: from.unreadableStylesheets, pageHeight: from.pageHeight }, png: null,
  }
  const rounds: Round[] = []
  const pages: RoundPage[] = []
  /** The shot of `good` when a round made it; undefined while it is still the dualkit page. */
  let goodShot: Buffer | null | undefined
  const failed = (error: string): Built => ({ record: { ...key, at, reply: null, usage: sumUsage(rounds), ms: sumMs(rounds), finish: null, reasoningTokens: null, servedModel: null, ok: false, error }, html: null, shot: null })
  for (let n = 1; n <= MAX_ROUNDS; n++) {
    if (n > 1 && late()) break
    let before = good
    const lint = lintPage(good.html)
    const feedback = feedbackPrompt(good.findings, lint)
    if (feedback === null) break
    if (good.text === null) {
      // The dualkit record keeps no page text, so the page it starts from is rendered once more for the Arabic count.
      const base = await scorer(good.html, screen).catch((e: unknown): Scored => ({ ok: false, error: errorText(e) }))
      if (!base.ok) return failed(`Render failed: ${base.error}`)
      good = { ...good, text: base.text }
      // Round 1 is measured against this same render, so a rule that differs between renders is not counted as harm.
      before = { ...good, findings: base.findings, missing: base.missing }
    }
    const sent = Math.min(MAX_ITEMS, good.findings.filter((f) => f.severity !== 'note').length + lint.length)
    const turns: Turn[] = [...good.turns, { role: 'assistant', content: good.reply }, { role: 'user', content: feedback }]
    const step = await round({ model, screen, generate, scorer, system: systemPrompt('loop', skillsDir), turns, sent, before })
    // A budget spent after round 1 keeps what the build has; before any round, the build is left for the next day.
    if ('error' in step && step.error === BUDGET_SPENT && n > 1) break
    if ('error' in step) return failed(step.error)
    rounds.push(step.round)
    if (step.page) {
      good = step.page
      goodShot = good.png !== null ? await shoot(good.png) : null
      pages.push({ round: n, html: good.html, shot: goodShot })
    }
  }
  const shot = goodShot !== undefined ? goodShot : readShot(store.paths(dualkitKey).webp)
  const record: BuildRecord = {
    ...key, at, reply: good.reply, usage: sumUsage(rounds), ms: sumMs(rounds), ...good.meta,
    ok: true, ...good.result, missing: good.missing, findings: good.findings,
    from: { rulesPassed: from.rulesPassed, score: from.score }, rounds,
  }
  return { record, html: good.html, shot, pages }
}

const sumMs = (rounds: Round[]) => rounds.reduce((t, r) => t + r.ms, 0)
const sumUsage = (rounds: Round[]): Usage | null => {
  const used = rounds.flatMap((r) => (r.usage ? [r.usage] : []))
  return used.length === 0 ? null : used.reduce((t, u) => ({ input: t.input + u.input, output: t.output + u.output }))
}
const readShot = (file: string) => (existsSync(file) ? readFileSync(file) : null)

type RoundInput = { model: ModelEntry; screen: Screen; generate: Generate; scorer: Scorer; system: string; turns: Turn[]; sent: number; before: Page }

/** One fix. A reply with no HTML, a page that will not render, or an API error that asking again will not clear is a failed round; an error that may clear is not a round at all, so the build is redone. */
async function round({ model, screen, generate, scorer, system, turns, sent, before }: RoundInput): Promise<{ error: string } | { round: Round; page: Page | null }> {
  const at = new Date().toISOString()
  const gen = await generate(model, { system, prompt: screen.prompt, turns })
  if (!gen.ok && !gen.reply && mayClear(gen.error)) return { error: gen.error }
  const reply = gen.ok ? gen : gen.reply ?? null
  const base = { at, ms: gen.ms, usage: reply?.usage ?? null, reply: reply?.text ?? null, sent }
  const lost = (error: string) => ({ round: { ...base, ok: false, error, rulesPassed: null, score: null, missing: [], regressed: [], lostParts: [], arabicKept: null }, page: null })
  if (!gen.ok) return lost(gen.error)
  const html = extractHtml(gen.text)
  if (html === null) return lost('No HTML in the reply')
  const s = await scorer(html, screen).catch((e: unknown): Scored => ({ ok: false, error: errorText(e) }))
  if (!s.ok) return lost(`Render failed: ${s.error}`)
  const lintFailed = failedRules(lintPage(html))
  const h = harm(
    { failed: [...failedRules(before.findings), ...before.lintFailed], missing: before.missing, text: before.text ?? '' },
    { failed: [...failedRules(s.findings), ...lintFailed], missing: s.missing, text: s.text },
  )
  const page: Page = {
    html, reply: gen.text, turns, findings: s.findings, lintFailed, missing: s.missing, text: s.text,
    meta: { finish: gen.finish, reasoningTokens: gen.reasoningTokens, servedModel: gen.servedModel },
    result: { rulesPassed: s.rulesPassed, score: s.score, unreadableStylesheets: s.unreadableStylesheets, pageHeight: s.pageHeight }, png: s.screenshot,
  }
  return { round: { ...base, ok: true, error: null, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, ...h }, page }
}
