/** The result of one app in the proof suite. */
export type AppResult = {
  id: string; repo: string; commit: string; framework: string
  outcome: 'converted' | 'refused' | 'crashed'; detail: string
  strings: number; missed: number; flags: number; seconds: number
  /** Type errors convert added. Absent when the run skipped type checking. */
  typeErrors?: number
  /** Whether the app built before and after converting. Absent when the run skipped builds. */
  buildBefore?: boolean
  buildAfter?: boolean
  buildDetail?: string
  /** Whether `--finish` passed on stand-in Arabic. Absent when the run skipped it. */
  finished?: boolean
  finishDetail?: string
}

/** Share of user-facing strings convert caught, as a whole percent. 0 when nothing was found. */
export const coverage = (strings: number, missed: number): number =>
  strings + missed === 0 ? 0 : Math.round((strings / (strings + missed)) * 100)

/** The suite totals the scoreboard leads with. */
export function summarise(results: AppResult[]) {
  const done = results.filter((r) => r.outcome === 'converted')
  const strings = done.reduce((n, r) => n + r.strings, 0)
  const missed = done.reduce((n, r) => n + r.missed, 0)
  const typeErrors = done.reduce((n, r) => n + (r.typeErrors ?? 0), 0)
  const buildable = done.filter((r) => r.buildBefore)
  const built = buildable.filter((r) => r.buildAfter).length
  return { apps: results.length, converted: done.length, strings, missed, coverage: coverage(strings, missed), typeErrors, buildable: buildable.length, built, finished: done.filter((r) => r.finished).length }
}

const buildCell = (r: AppResult): string => {
  if (r.buildBefore === undefined) return '-'
  if (!r.buildBefore) return 'not buildable before'
  return r.buildAfter ? 'yes' : 'no'
}

/** The scoreboard as Markdown. */
export function scoreboard(results: AppResult[], date: string): string {
  const s = summarise(results)
  const rows = results.map((r) =>
    `| [${r.id}](https://github.com/${r.repo}/tree/${r.commit}) | ${r.framework} | ${r.outcome} | ${r.strings} | ${r.missed} | ${r.outcome === 'converted' ? `${coverage(r.strings, r.missed)}%` : '-'} | ${r.flags} | ${r.typeErrors ?? '-'} | ${buildCell(r)} | ${r.finished === undefined ? '-' : r.finished ? 'yes' : 'no'} |`)
  return [
    '# Dualkit proof scoreboard', '',
    `Measured ${date}. Convert ran on ${s.apps} real open-source apps, each pinned to one commit.`, '',
    `- Apps converted without error: ${s.converted} of ${s.apps}`,
    `- Strings moved into translation files: ${s.strings}`,
    `- English strings left behind: ${s.missed}`,
    `- String coverage: ${s.coverage}%`,
    `- New type errors after converting: ${s.typeErrors}`,
    `- Apps that still build after converting: ${s.built} of ${s.buildable} that built before`,
    `- Apps that pass \`--finish\`: ${s.finished} of ${s.converted}`, '',
    'This run covers phase 1, a TypeScript check, a production build before and after, and `--finish` on stand-in Arabic. Stand-in Arabic proves the layout and the wiring, not the translation.',
    'The left-behind count comes from a separate scanner, and it is a floor because that scanner cannot see strings built at run time.', '',
    '| App | Framework | Outcome | Strings | Left behind | Coverage | Flags | New type errors | Builds after | Passes finish |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows, '',
  ].join('\n')
}
