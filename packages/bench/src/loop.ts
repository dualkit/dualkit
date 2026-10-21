import { existsSync, readFileSync } from 'node:fs'
import type { ModelEntry, Screen } from './config'
import { extractHtml } from './extract'
import { feedbackPrompt, lintPage, MAX_ITEMS } from './feedback'
import type { Generate, Turn, Usage } from './providers'
import type { Scored, SlimFinding } from './score'
import type { BuildKey, BuildRecord, Round, Store } from './store'
import { SKILLS_DIR, systemPrompt } from './system'

export type { Round }
/** Fix rounds per loop build, after the dualkit build it starts from. */
export const MAX_ROUNDS = 2

export type Built = { record: BuildRecord; html: string | null; shot: Buffer | null }
type Side = { failed: string[]; missing: string[]; text: string }
type OkScored = Extract<Scored, { ok: true }>
type Scorer = (html: string, screen: Screen) => Promise<Scored>
type Meta = { finish: string | null; reasoningTokens: number | null; servedModel: string | null }
/** The last page that rendered, and the turns that led to it (none for the dualkit page). */
type Page = { html: string; reply: string; turns: Turn[]; findings: SlimFinding[]; missing: string[]; text: string | null; meta: Meta
  result: Pick<OkScored, 'rulesPassed' | 'score' | 'unreadableStylesheets' | 'pageHeight'>; png: string | null }

const ARABIC = /[ء-ي]/g
const letters = (text: string) => {
  const counts = new Map<string, number>()
  for (const c of text.match(ARABIC) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
  return counts
}
const failedRules = (findings: SlimFinding[]) => [...new Set(findings.filter((f) => f.severity !== 'note').map((f) => f.rule))]
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
  /** Turns the final page's PNG into the stored WebP. */
  shoot: (png: string) => Promise<Buffer | null> }

/** Sends the dualkit page's check and lint findings back for up to MAX_ROUNDS fixes. Null when there is no dualkit page to start from, so nothing is written and a rerun tries again. */
export async function loopBuild({ key, model, screen, generate, store, scorer, skillsDir = SKILLS_DIR, shoot }: Input): Promise<Built | null> {
  const dualkitKey: BuildKey = { ...key, condition: 'dualkit' }
  const from = store.read(dualkitKey)
  const htmlFile = store.paths(dualkitKey).html
  if (!from?.ok || from.reply === null || !existsSync(htmlFile)) return null
  const at = new Date().toISOString()
  let good: Page = {
    html: readFileSync(htmlFile, 'utf8'), reply: from.reply, turns: [], findings: from.findings, missing: from.missing, text: null,
    meta: { finish: from.finish, reasoningTokens: from.reasoningTokens, servedModel: from.servedModel },
    result: { rulesPassed: from.rulesPassed, score: from.score, unreadableStylesheets: from.unreadableStylesheets, pageHeight: from.pageHeight }, png: null,
  }
  const rounds: Round[] = []
  const failed = (error: string): Built => ({ record: { ...key, at, reply: null, usage: null, ms: sumMs(rounds), finish: null, reasoningTokens: null, servedModel: null, ok: false, error }, html: null, shot: null })
  for (let n = 1; n <= MAX_ROUNDS; n++) {
    const lint = lintPage(good.html)
    const feedback = feedbackPrompt(good.findings, lint)
    if (feedback === null) break
    if (good.text === null) {
      // The dualkit record keeps no page text, so the page it starts from is rendered once more for the Arabic count.
      const base = await scorer(good.html, screen).catch((e: unknown): Scored => ({ ok: false, error: errorText(e) }))
      if (!base.ok) return failed(`Render failed: ${base.error}`)
      good = { ...good, text: base.text }
    }
    const sent = Math.min(MAX_ITEMS, good.findings.filter((f) => f.severity !== 'note').length + lint.length)
    const turns: Turn[] = [...good.turns, { role: 'assistant', content: good.reply }, { role: 'user', content: feedback }]
    const step = await round({ model, screen, generate, scorer, system: systemPrompt('loop', skillsDir), turns, sent, before: good })
    if ('error' in step) return failed(step.error)
    rounds.push(step.round)
    if (step.page) good = step.page
  }
  const shot = good.png !== null ? await shoot(good.png) : readShot(store.paths(dualkitKey).webp)
  const record: BuildRecord = {
    ...key, at, reply: good.reply, usage: sumUsage(rounds), ms: sumMs(rounds), ...good.meta,
    ok: true, ...good.result, missing: good.missing, findings: good.findings,
    from: { rulesPassed: from.rulesPassed, score: from.score }, rounds,
  }
  return { record, html: good.html, shot }
}

const sumMs = (rounds: Round[]) => rounds.reduce((t, r) => t + r.ms, 0)
const sumUsage = (rounds: Round[]): Usage | null => {
  const used = rounds.flatMap((r) => (r.usage ? [r.usage] : []))
  return used.length === 0 ? null : used.reduce((t, u) => ({ input: t.input + u.input, output: t.output + u.output }))
}
const readShot = (file: string) => (existsSync(file) ? readFileSync(file) : null)

type RoundInput = { model: ModelEntry; screen: Screen; generate: Generate; scorer: Scorer; system: string; turns: Turn[]; sent: number; before: Page }

/** One fix. A reply with no HTML, or a page that will not render, is a failed round; an API error with no reply is not a round at all. */
async function round({ model, screen, generate, scorer, system, turns, sent, before }: RoundInput): Promise<{ error: string } | { round: Round; page: Page | null }> {
  const at = new Date().toISOString()
  const gen = await generate(model, { system, prompt: screen.prompt, turns })
  if (!gen.ok && !gen.reply) return { error: gen.error }
  const reply = gen.ok ? gen : gen.reply!
  const base = { at, ms: gen.ms, usage: reply.usage, reply: reply.text, sent }
  const lost = (error: string) => ({ round: { ...base, ok: false, error, rulesPassed: null, score: null, missing: [], regressed: [], lostParts: [], arabicKept: null }, page: null })
  if (!gen.ok) return lost(gen.error)
  const html = extractHtml(gen.text)
  if (html === null) return lost('No HTML in the reply')
  const s = await scorer(html, screen).catch((e: unknown): Scored => ({ ok: false, error: errorText(e) }))
  if (!s.ok) return lost(`Render failed: ${s.error}`)
  const failed = failedRules(s.findings)
  const h = harm({ failed: failedRules(before.findings), missing: before.missing, text: before.text ?? '' }, { failed, missing: s.missing, text: s.text })
  const page: Page = {
    html, reply: gen.text, turns, findings: s.findings, missing: s.missing, text: s.text,
    meta: { finish: gen.finish, reasoningTokens: gen.reasoningTokens, servedModel: gen.servedModel },
    result: { rulesPassed: s.rulesPassed, score: s.score, unreadableStylesheets: s.unreadableStylesheets, pageHeight: s.pageHeight }, png: s.screenshot,
  }
  return { round: { ...base, ok: true, error: null, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, ...h }, page }
}
