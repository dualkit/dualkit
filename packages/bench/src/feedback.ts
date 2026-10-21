import { lintText, type LintFinding } from '@dualkit/lint'
import type { SlimFinding } from './score'

export const MAX_ITEMS = 40
const SNIPPET_MAX = 160
const HEADER = 'dualkit check and dualkit lint found these problems in your page.'
const FOOTER = 'Fix these. Change only what they need. Reply with the whole file.'

/** Lints the page source the way `dualkit lint` does; notes are never sent back to the model. */
export function lintPage(html: string): LintFinding[] {
  return lintText('index.html', html).filter((f) => f.severity !== 'note')
}

/** The prompt that asks a model to fix its page, or null when nothing at warning or error is left. */
export function feedbackPrompt(check: SlimFinding[], lint: LintFinding[]): string | null {
  const checks = check.filter((f) => f.severity !== 'note')
  const lints = lint.filter((f) => f.severity !== 'note').sort((a, b) => a.line - b.line || a.column - b.column)
  const items = [
    ...checks.map((f) => {
      const element = f.snippet ? ` Element: \`${f.snippet.slice(0, SNIPPET_MAX)}\`.` : ''
      return `[check] ${f.title} (${f.rule}): ${f.message}${element} How to fix: ${f.fix}`
    }),
    ...lints.map((f) => `[lint] ${f.title} (${f.rule}), line ${f.line}: ${f.message} How to fix: ${f.fix}`),
  ]
  if (items.length === 0) return null
  const lines = items.slice(0, MAX_ITEMS).map((t, i) => `${i + 1}. ${t}`)
  const more = items.length - MAX_ITEMS
  return [HEADER, '', ...lines, ...(more > 0 ? [`…and ${more} more.`] : []), '', FOOTER].join('\n')
}
