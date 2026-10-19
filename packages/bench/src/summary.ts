import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import type { BenchCell, BenchModel, BenchMonth } from '../../../apps/site/lib/bench-schema'
import { cell, lift, total, type BuildScore } from './cells'
import { ROOT, RUN, type ModelEntry, type Screen } from './config'
import { RULE_COUNT, scoreHtml } from './score'
import type { BuildRecord, Condition, Store } from './store'

const REPO = join(ROOT, '..', '..')
export const SITE_ROOT = join(REPO, 'apps', 'site')
type Shots = (rec: BuildRecord, html: string) => Promise<{ file: string; pageHeight: number } | null>

const defaultShots = (month: string, screens: Screen[]): Shots => async (rec, html) => {
  const screen = screens.find((s) => s.id === rec.screen)
  if (!screen) return null
  const scored = await scoreHtml(html, screen.required)
  if (!scored.ok) return null
  const rel = join('bench', month, rec.model, `${rec.screen}-${rec.condition}.webp`)
  const out = join(SITE_ROOT, 'public', rel)
  mkdirSync(dirname(out), { recursive: true })
  await sharp(Buffer.from(scored.screenshot, 'base64')).resize({ width: RUN.width }).webp({ quality: 90 }).toFile(out)
  return { file: `/${rel.split('\\').join('/')}`, pageHeight: scored.pageHeight }
}

// The raw path is always the repo layout, so the page can link to it whatever root the store was given.
const rawPath = (r: BuildRecord) => `bench/runs/${r.month}/${r.model}/${r.screen}/${r.condition}-${r.run}.json`

async function benchCell(store: Store, records: BuildRecord[], shots: Shots): Promise<BenchCell> {
  const ok = records.filter((r): r is Extract<BuildRecord, { ok: true }> => r.ok)
  const c = cell(ok.map((r): BuildScore => ({ run: r.run, rulesPassed: r.rulesPassed, score: r.score, missing: r.missing })))
  if (!c.ran) return { ran: false, runs: c.runs }
  const rec = ok.find((r) => r.run === c.median.run)!
  let shot: { file: string; pageHeight: number } | null = null
  try {
    shot = await shots(rec, readFileSync(store.paths(rec).html, 'utf8'))
  } catch (e) {
    console.warn(`Screenshot failed for ${rec.model}/${rec.screen}/${rec.condition}: ${e instanceof Error ? e.message : String(e)}`)
    shot = null
  }
  return {
    ran: true, runs: c.runs, rulesPassed: c.rulesPassed, score: c.score, missing: rec.missing, findings: rec.findings,
    shot: shot?.file ?? null, pageHeight: shot?.pageHeight ?? 0, raw: rawPath(rec),
  }
}

const rank = (a: BenchModel, b: BenchModel) =>
  (b.dualkit?.rulesPassed ?? -1) - (a.dualkit?.rulesPassed ?? -1) || (b.alone?.rulesPassed ?? -1) - (a.alone?.rulesPassed ?? -1) || a.label.localeCompare(b.label)

export async function buildSummary({ month, models, screens, store, shots = defaultShots(month, screens) }: { month: string; models: ModelEntry[]; screens: Screen[]; store: Store; shots?: Shots }): Promise<BenchMonth> {
  const records = store.list(month)
  const out: BenchModel[] = []
  for (const m of models) {
    const rows: BenchModel['screens'] = []
    for (const s of screens) {
      const pick = (condition: Condition) => records.filter((r) => r.model === m.id && r.screen === s.id && r.condition === condition)
      rows.push({ id: s.id, title: s.title, alone: await benchCell(store, pick('alone'), shots), dualkit: await benchCell(store, pick('dualkit'), shots) })
    }
    const alone = total(rows.map((r) => r.alone), RULE_COUNT)
    const dualkit = total(rows.map((r) => r.dualkit), RULE_COUNT)
    out.push({ id: m.id, label: m.label, provider: m.provider, isNew: m.since === month, alone, dualkit, lift: lift(alone, dualkit), screens: rows })
  }
  return { month, generatedAt: new Date().toISOString(), ruleCount: RULE_COUNT, models: out.sort(rank) }
}

export function writeSummary(month: BenchMonth, siteRoot = SITE_ROOT): string {
  const file = join(siteRoot, 'content', 'bench', `${month.month}.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(month, null, 2)}\n`)
  return file
}
