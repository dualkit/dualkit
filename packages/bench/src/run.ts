import { chromium, type Browser } from 'playwright'
import { RUN, type ModelEntry, type Screen } from './config'
import { extractHtml } from './extract'
import type { Generate } from './providers'
import { scoreHtml } from './score'
import type { BuildKey, BuildRecord, Condition, Store } from './store'
import { checkSkills, SKILLS_DIR, systemPrompt } from './system'

const CONDITIONS: readonly Condition[] = ['alone', 'dualkit']
const LOCKED = /^No [A-Z_]+_API_KEY$|^HTTP (401|403|404)\b/
const LOCK_AFTER = 3
const NO_REPLY = { reply: null, usage: null, finish: null, reasoningTokens: null, servedModel: null } as const

export const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7)

type Options = { month: string; models: ModelEntry[]; screens: Screen[]; generate: Generate; store: Store; score?: typeof scoreHtml; log?: (line: string) => void; skillsDir?: string }

export async function runBench({ month, models, screens, generate, store, score = scoreHtml, log = () => {}, skillsDir = SKILLS_DIR }: Options) {
  checkSkills(skillsDir)
  const counts = { built: 0, skipped: 0, failed: 0 }
  const browser = score === scoreHtml ? await chromium.launch() : undefined
  try {
    for (const model of models) {
      let locked = 0
      for (const screen of screens) for (const condition of CONDITIONS) for (let run = 1; run <= RUN.runs; run++) {
        const key: BuildKey = { month, model: model.id, screen: screen.id, condition, run }
        if (store.isDone(key)) { counts.skipped++; continue }
        if (locked >= LOCK_AFTER) continue
        const rec = await build(key, model, screen, generate, score, skillsDir, browser)
        locked = !rec.record.ok && LOCKED.test(rec.record.error) ? locked + 1 : 0
        store.write(rec.record, rec.html)
        if (rec.record.ok) counts.built++
        else counts.failed++
        log(`${key.model} ${key.screen} ${key.condition} ${key.run}: ${rec.record.ok ? `${rec.record.rulesPassed} rules` : rec.record.error}`)
      }
      if (locked >= LOCK_AFTER) log(`${model.id}: skipped for this run after ${LOCK_AFTER} access errors`)
    }
  } finally {
    await browser?.close().catch(() => {})
  }
  return counts
}

async function build(key: BuildKey, model: ModelEntry, screen: Screen, generate: Generate, score: typeof scoreHtml, skillsDir: string, browser?: Browser): Promise<{ record: BuildRecord; html: string | null }> {
  const base = { ...key, at: new Date().toISOString() }
  const gen = await generate(model, { system: systemPrompt(key.condition, skillsDir), prompt: screen.prompt })
  if (!gen.ok) {
    const r = gen.reply
    const reply = r ? { reply: r.text, usage: r.usage, finish: r.finish, reasoningTokens: r.reasoningTokens, servedModel: r.servedModel } : NO_REPLY
    return { record: { ...base, ...reply, ms: gen.ms, ok: false, error: gen.error }, html: null }
  }
  const meta = { ...base, reply: gen.text, usage: gen.usage, ms: gen.ms, finish: gen.finish, reasoningTokens: gen.reasoningTokens, servedModel: gen.servedModel }
  const html = extractHtml(gen.text)
  if (html === null) return { record: { ...meta, ok: false, error: 'No HTML in the reply' }, html: null }
  try {
    const s = await score(html, screen.required, browser ? { browser } : {})
    if (!s.ok) return { record: { ...meta, ok: false, error: `Render failed: ${s.error}` }, html }
    return { record: { ...meta, ok: true, rulesPassed: s.rulesPassed, score: s.score, missing: s.missing, findings: s.findings, unreadableStylesheets: s.unreadableStylesheets }, html }
  } catch (e) {
    return { record: { ...meta, ok: false, error: `Render failed: ${e instanceof Error ? e.message : String(e)}` }, html }
  }
}
