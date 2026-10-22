import type { Finding } from '@dualkit/rules'
import type { AuditResult } from './audit'

const paint = (on: boolean, code: number, s: string) => (on ? `\u001b[${code}m${s}\u001b[0m` : s)
const MARK = { error: '✖', warning: '▲', note: '·' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function groupByRule(findings: readonly Finding[]): Finding[][] {
  const groups = new Map<string, Finding[]>()
  for (const f of findings) groups.set(f.rule, [...(groups.get(f.rule) ?? []), f])
  return [...groups.values()]
}

export function formatSummary(result: AuditResult, color = Boolean(process.stdout.isTTY)): string {
  const groups = groupByRule(result.findings)
  const errors = groups.filter((g) => g[0]!.severity === 'error').length
  const warnings = groups.filter((g) => g[0]!.severity === 'warning').length
  const lines = [
    '',
    `${paint(color, 1, `Score ${result.score}/100`)}  ${result.url}`,
    groups.length === 0 ? 'No issues found.' : `${errors} rule${errors === 1 ? '' : 's'} with errors, ${warnings} with warnings`,
    '',
    ...groups.map((g) => {
      const f = g[0]!
      const code = f.severity === 'error' ? 31 : f.severity === 'warning' ? 33 : 2
      return `${paint(color, code, MARK[f.severity])} ${f.rule} (${g.length})  ${f.fix}`
    }),
  ]
  if (result.unreadableStylesheets > 0) lines.push('', `${plural(result.unreadableStylesheets, 'stylesheet')} could not be read, so layout checks may miss rules in them.`)
  return `${lines.join('\n')}\n`
}

/** Review findings under the check summary, each marked `review` with its confidence. They never change the score. */
export function formatReview({ findings, spentUsd }: { findings: readonly Finding[]; spentUsd: number }, color = Boolean(process.stdout.isTTY)): string {
  if (findings.length === 0) return ''
  const lines = ['', paint(color, 1, `Review found ${plural(findings.length, 'thing')} worth a look (the model can be wrong)`)]
  for (const f of findings) {
    const where = f.line ? ` line ${f.line}` : ''
    lines.push(`${paint(color, 33, MARK.warning)} ${paint(color, 2, 'review')} ${f.rule}${where}  ${f.message} (${Math.round((f.confidence ?? 0) * 100)}% sure)`)
  }
  if (spentUsd > 0) lines.push(`Review spent $${spentUsd.toFixed(4)}`)
  return `${lines.join('\n')}\n`
}
