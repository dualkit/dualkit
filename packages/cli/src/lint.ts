import type { LintFinding, LintResult } from '@dualkit/lint'

const paint = (on: boolean, code: number, s: string) => (on ? `\u001b[${code}m${s}\u001b[0m` : s)
const MARK = { error: '✖', warning: '▲', note: '·' } as const
const COLOR = { error: 31, warning: 33, note: 2 } as const
const number = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Lowest to highest. A finding fails the run when its rank is at or above the --fail-on rank. */
export const SEVERITY_RANK = { note: 0, warning: 1, error: 2 } as const
export type FailOn = keyof typeof SEVERITY_RANK

export const isFailOn = (v: string): v is FailOn => Object.hasOwn(SEVERITY_RANK, v)

export const shouldFail = (result: LintResult, failOn: FailOn): boolean =>
  result.findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[failOn])

const count = (findings: readonly LintFinding[], severity: LintFinding['severity']) =>
  findings.filter((f) => f.severity === severity).length

export function formatLint(result: LintResult, color: boolean): string {
  const { findings, files } = result
  const lines = findings.map((f) =>
    `${f.file}:${f.line}:${f.column}  ${paint(color, COLOR[f.severity], MARK[f.severity])} ${f.rule}  ${f.message}`)
  if (lines.length > 0) lines.push('')
  lines.push(
    findings.length === 0
      ? `No issues found in ${plural(files, 'file')}.`
      : `${plural(count(findings, 'error'), 'error')}, ${plural(count(findings, 'warning'), 'warning')}, ${plural(count(findings, 'note'), 'note')} in ${plural(files, 'file')}`,
  )
  for (const q of result.quiet ?? []) lines.push(quietLine(q))
  return `${lines.join('\n')}\n`
}

const quietLine = (q: LintResult['quiet'][number]): string => {
  const n = number(q.files)
  switch (q.reason) {
    case 'flipped': return `Skipped physical rules in ${n} files flipped by ${q.flipper ?? 'a build step'}.`
    case 'example': return `Skipped physical rules in ${n} example files.`
    case 'generated': return `Skipped physical rules in ${n} generated files.`
    case 'email': return `Skipped physical rules in ${n} email templates.`
  }
}

/** One line per skipped file, for stderr, so stdout holds only the findings. */
export const formatSkipped = (result: LintResult): string =>
  result.skipped.map((s) => `skipped ${s.file}: ${s.reason}\n`).join('')
