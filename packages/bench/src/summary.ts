import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BenchCell, BenchModel, BenchMonth } from '../../../apps/site/lib/bench-schema'
import { cell, lift, total, type BuildScore } from './cells'
import { ROOT, type ModelEntry, type Screen } from './config'
import { RULE_COUNT } from './score'
import type { BuildRecord, Condition, Store } from './store'

const REPO = join(ROOT, '..', '..')
export const SITE_ROOT = join(REPO, 'apps', 'site')
type Ok = Extract<BuildRecord, { ok: true }>
type Shots = (rec: Ok) => Promise<string | null>

/** Copies the median build's own WebP, saved by the runner from the scoring render, so the picture is the build that was scored. */
export const copyShots = (store: Store, siteRoot = SITE_ROOT): Shots => async (rec) => {
  const from = store.paths(rec).webp
  if (!existsSync(from)) {
    console.warn(`No screenshot for ${rec.model}/${rec.screen}/${rec.condition}-${rec.run}: ${from} is missing`)
    return null
  }
  const rel = join('bench', rec.month, rec.model, `${rec.screen}-${rec.condition}.webp`)
  const out = join(siteRoot, 'public', rel)
  mkdirSync(dirname(out), { recursive: true })
  copyFileSync(from, out)
  return `/${rel.split('\\').join('/')}`
}

// The raw path is always the repo layout, so the page can link to it whatever root the store was given.
const rawPath = (r: BuildRecord) => `bench/runs/${r.month}/${r.model}/${r.screen}/${r.condition}-${r.run}.json`

async function benchCell(records: BuildRecord[], shots: Shots): Promise<BenchCell> {
  const ok = records.filter((r): r is Ok => r.ok)
  const c = cell(ok.map((r): BuildScore => ({ run: r.run, rulesPassed: r.rulesPassed, score: r.score, missing: r.missing })))
  if (!c.ran) return { ran: false, runs: c.runs }
  const rec = ok.find((r) => r.run === c.median.run)!
  let shot: string | null = null
  try {
    shot = await shots(rec)
  } catch (e) {
    console.warn(`Screenshot failed for ${rec.model}/${rec.screen}/${rec.condition}: ${e instanceof Error ? e.message : String(e)}`)
  }
  return {
    ran: true, runs: c.runs, rulesPassed: c.rulesPassed, score: c.score, missing: rec.missing, findings: rec.findings,
    shot, pageHeight: rec.pageHeight, raw: rawPath(rec),
  }
}

/** The time of the newest build, not now: a rerun with nothing new then writes the same bytes, and the workflow commits nothing. */
const newestBuild = (records: BuildRecord[], month: string) =>
  records.reduce((newest, r) => (r.at > newest ? r.at : newest), `${month}-01T00:00:00.000Z`)

const rank = (a: BenchModel, b: BenchModel) =>
  (b.dualkit?.rulesPassed ?? -1) - (a.dualkit?.rulesPassed ?? -1) || (b.alone?.rulesPassed ?? -1) - (a.alone?.rulesPassed ?? -1) || a.label.localeCompare(b.label)

type SummaryOptions = { month: string; models: ModelEntry[]; screens: Screen[]; store: Store; siteRoot?: string; shots?: Shots }

export async function buildSummary({ month, models, screens, store, siteRoot = SITE_ROOT, shots = copyShots(store, siteRoot) }: SummaryOptions): Promise<BenchMonth> {
  const records = store.list(month)
  const out: BenchModel[] = []
  for (const m of models) {
    const rows: BenchModel['screens'] = []
    for (const s of screens) {
      const pick = (condition: Condition) => records.filter((r) => r.model === m.id && r.screen === s.id && r.condition === condition)
      rows.push({ id: s.id, title: s.title, alone: await benchCell(pick('alone'), shots), dualkit: await benchCell(pick('dualkit'), shots) })
    }
    const alone = total(rows.map((r) => r.alone), RULE_COUNT)
    const dualkit = total(rows.map((r) => r.dualkit), RULE_COUNT)
    out.push({ id: m.id, label: m.label, provider: m.provider, isNew: m.since === month, alone, dualkit, lift: lift(alone, dualkit), screens: rows })
  }
  return { month, generatedAt: newestBuild(records, month), ruleCount: RULE_COUNT, models: out.sort(rank) }
}

export function writeSummary(month: BenchMonth, siteRoot = SITE_ROOT): string {
  const file = join(siteRoot, 'content', 'bench', `${month.month}.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(month, null, 2)}\n`)
  return file
}
