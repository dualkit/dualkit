/** The result of one app in the proof suite. */
export type AppResult = {
  id: string; repo: string; commit: string; framework: string
  outcome: 'converted' | 'refused' | 'crashed'; detail: string
  strings: number; missed: number; flags: number; seconds: number
}

/** Share of user-facing strings convert caught, as a whole percent. 0 when nothing was found. */
export const coverage = (strings: number, missed: number): number =>
  strings + missed === 0 ? 0 : Math.round((strings / (strings + missed)) * 100)

/** The suite totals the scoreboard leads with. */
export function summarise(results: AppResult[]) {
  const done = results.filter((r) => r.outcome === 'converted')
  const strings = done.reduce((n, r) => n + r.strings, 0)
  const missed = done.reduce((n, r) => n + r.missed, 0)
  return { apps: results.length, converted: done.length, strings, missed, coverage: coverage(strings, missed) }
}

/** The scoreboard as Markdown. */
export function scoreboard(results: AppResult[], date: string): string {
  const s = summarise(results)
  const rows = results.map((r) =>
    `| [${r.id}](https://github.com/${r.repo}/tree/${r.commit}) | ${r.framework} | ${r.outcome} | ${r.strings} | ${r.missed} | ${r.outcome === 'converted' ? `${coverage(r.strings, r.missed)}%` : '-'} | ${r.flags} |`)
  return [
    '# Dualkit proof scoreboard', '',
    `Measured ${date}. Convert ran on ${s.apps} real open-source apps, each pinned to one commit.`, '',
    `- Apps converted without error: ${s.converted} of ${s.apps}`,
    `- Strings moved into translation files: ${s.strings}`,
    `- English strings left behind: ${s.missed}`,
    `- String coverage: ${s.coverage}%`, '',
    'This run covers phase 1 only. It does not yet measure whether the app still builds or whether `--finish` passes.',
    'The left-behind count comes from a separate scanner, and it is a floor because that scanner cannot see strings built at run time.', '',
    '| App | Framework | Outcome | Strings | Left behind | Coverage | Flags |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows, '',
  ].join('\n')
}
