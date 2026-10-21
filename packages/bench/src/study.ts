import { cell, type BuildScore } from './cells'
import type { ModelEntry, Screen } from './config'
import { RULE_COUNT } from './score'
import type { BuildRecord, Condition, Round } from './store'

/** The pass bars from the study plan. */
export const BARS = { modelsHalved: 4, harmRate: 0.1 } as const
/** A round that kept less than this share of the page's Arabic text shrank it. Information only, not a bar. */
export const SHRUNK_BELOW = 0.9

const SETUPS = ['alone', 'dualkit', 'loop'] as const
type Failed = Record<(typeof SETUPS)[number], number | null>
export type StudyModel = { id: string; label: string; failed: Failed; halved: boolean | null }
export type Study = {
  models: StudyModel[]; modelsHalved: number
  /** Rounds that ran and rendered; failed rounds are left out of the harm rate. */
  rounds: number; harmfulRounds: number; harmRate: number | null; shrunk: number
  incomplete: { dualkit: number; loop: number }
  pass: { gain: boolean; harm: boolean; honest: boolean }
}

type Ok = Extract<BuildRecord, { ok: true }>
const isOk = (r: BuildRecord): r is Ok => r.ok

/** Rules failed over every screen, from the same median cells the bench shows; null when any cell did not run. */
function failedRules(records: Ok[], screens: Screen[], condition: Condition): number | null {
  let sum = 0
  for (const s of screens) {
    const c = cell(records.filter((r) => r.screen === s.id && r.condition === condition).map((r): BuildScore => ({ run: r.run, rulesPassed: r.rulesPassed, score: r.score, missing: r.missing })))
    if (!c.ran) return null
    sum += RULE_COUNT - c.rulesPassed
  }
  return sum
}

function studyModel(m: ModelEntry, records: Ok[], screens: Screen[]): StudyModel {
  const own = records.filter((r) => r.model === m.id)
  const failed = Object.fromEntries(SETUPS.map((c) => [c, failedRules(own, screens, c)])) as Failed
  const halved = failed.alone === null || failed.loop === null ? null : failed.loop <= failed.alone / 2
  return { id: m.id, label: m.label, failed, halved }
}

const harmful = (r: Round) => r.regressed.length > 0 || r.lostParts.length > 0

export function study(records: BuildRecord[], models: ModelEntry[], screens: Screen[]): Study {
  const ids = new Set(models.map((m) => m.id))
  const screenIds = new Set(screens.map((s) => s.id))
  const ok = records.filter(isOk).filter((r) => ids.has(r.model) && screenIds.has(r.screen))
  const rows = models.map((m) => studyModel(m, ok, screens))
  const ran = ok.filter((r) => r.condition === 'loop').flatMap((r) => r.rounds ?? []).filter((r) => r.ok)
  const harmfulRounds = ran.filter(harmful).length
  const harmRate = ran.length === 0 ? null : harmfulRounds / ran.length
  const incomplete = (c: Condition) => ok.filter((r) => r.condition === c && r.missing.length > 0).length
  const modelsHalved = rows.filter((r) => r.halved === true).length
  const counts = { dualkit: incomplete('dualkit'), loop: incomplete('loop') }
  return {
    models: rows, modelsHalved, rounds: ran.length, harmfulRounds, harmRate,
    shrunk: ran.filter((r) => r.arabicKept !== null && r.arabicKept < SHRUNK_BELOW).length,
    incomplete: counts,
    pass: { gain: modelsHalved >= BARS.modelsHalved, harm: harmRate !== null && harmRate <= BARS.harmRate, honest: counts.loop <= counts.dualkit },
  }
}

const num = (n: number | null) => (n === null ? 'did not run' : String(n))
const yesNo = (b: boolean | null) => (b === null ? 'n/a' : b ? 'yes' : 'no')
const verdict = (b: boolean) => (b ? 'pass' : 'fail')
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`

/** A Markdown table and the three bars, ready to paste into the study report. */
export function renderStudy(s: Study): string {
  const table = [
    '| Model | Failed alone | With skills | With loop | Halved |',
    '| --- | ---: | ---: | ---: | --- |',
    ...s.models.map((m) => `| ${m.label} | ${num(m.failed.alone)} | ${num(m.failed.dualkit)} | ${num(m.failed.loop)} | ${yesNo(m.halved)} |`),
  ]
  const harm = s.harmRate === null
    ? 'no fix round ran and rendered, so there is no rate'
    : `${s.harmfulRounds} of ${s.rounds} fix rounds that ran and rendered made something worse, ${percent(s.harmRate)}`
  const bars = [
    `- Gain: ${s.modelsHalved} of ${s.models.length} models at least halved their failed rules with the loop (needs ${BARS.modelsHalved}): ${verdict(s.pass.gain)}`,
    `- Harm: ${harm} (needs ${percent(BARS.harmRate)} or less): ${verdict(s.pass.harm)}`,
    `- Honest: ${s.incomplete.loop} incomplete builds with the loop, ${s.incomplete.dualkit} with skills (needs no more with the loop): ${verdict(s.pass.honest)}`,
  ]
  const shrunk = `Shrunk Arabic: ${s.shrunk} of ${s.rounds} rounds kept less than ${percent(SHRUNK_BELOW)} of the Arabic text. Information, not a bar.`
  return [...table, '', ...bars, '', shrunk].join('\n')
}
