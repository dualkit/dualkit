import { RUN } from './config'

export type BuildScore = { run: number; rulesPassed: number; score: number; missing: string[] }
export type Cell = { ran: false; runs: number } | { ran: true; runs: number; median: BuildScore; rulesPassed: number; score: number }
export type Total = { rulesPassed: number; outOf: number; score: number }

/** An incomplete build left out a part the prompt asked for, so it scores nothing: skipping the hard parts must never pay. */
export const effective = (b: BuildScore) => (b.missing.length > 0 ? { rulesPassed: 0, score: 0 } : { rulesPassed: b.rulesPassed, score: b.score })

export function cell(builds: readonly BuildScore[]): Cell {
  if (builds.length < RUN.minRuns) return { ran: false, runs: builds.length }
  const sorted = [...builds].sort((a, c) => {
    const ea = effective(a), ec = effective(c)
    return ea.rulesPassed - ec.rulesPassed || ea.score - ec.score || c.run - a.run
  })
  // The lower middle: with three it is the median, with two the worse one. Always a build that exists.
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!
  return { ran: true, runs: builds.length, median, ...effective(median) }
}

export type Scorable = { ran: false } | { ran: true; rulesPassed: number; score: number }

export function total(cells: readonly Scorable[], ruleCount: number): Total | null {
  const ran = cells.filter((c): c is Extract<Scorable, { ran: true }> => c.ran)
  if (ran.length !== cells.length || ran.length === 0) return null
  return {
    rulesPassed: ran.reduce((s, c) => s + c.rulesPassed, 0),
    outOf: ruleCount * ran.length,
    score: Math.round(ran.reduce((s, c) => s + c.score, 0) / ran.length),
  }
}

export const lift = (alone: Total | null, dualkit: Total | null): number | null => (alone && dualkit ? dualkit.rulesPassed - alone.rulesPassed : null)
