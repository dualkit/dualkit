// The top of the report: the header, the score, the verdict, and the counts by severity and family.
import type { Finding } from '@dualkit/rules'
import type { AuditResult } from '../audit'
import { escapeHtml } from '../escape'
import { formatDate, plural, verdict } from './format'

const FAMILIES: ReadonlyArray<[Finding['group'], string]> = [
  ['bidi', 'Bidi'], ['layout', 'Layout'], ['icons', 'Icons'], ['type', 'Type'], ['content', 'Content'],
]

/** The two-halves Dualkit mark. */
const LOGO = '<svg class="logo" viewBox="-2 -2 24 24" aria-hidden="true"><path class="l1" d="M8.99 18.55C8.99 19.47 8.21 20.2 7.35 19.95C3.11 18.75 0 14.75 0 10C0 5.25 3.11 1.25 7.35.05C8.21-.2 8.99.53 8.99 1.45Z"/><path class="l2" d="M11.01 1.45C11.01.53 11.79-.2 12.65.05C16.89 1.25 20 5.25 20 10C20 14.75 16.89 18.75 12.65 19.95C11.79 20.2 11.01 19.47 11.01 18.55Z"/></svg>'

const n3 = (n: number) => Number(n.toFixed(3)).toString()

export function renderHeader(result: AuditResult, ruleCount: number): string {
  return `<header class="top"><div class="brand">${LOGO}<span>Dualkit check</span></div><p class="meta"><span class="url">${escapeHtml(result.url)}</span><span>${escapeHtml(formatDate(result.date))} · ${result.width}px wide · ${ruleCount} rules</span></p></header>`
}

function familyBars(findings: readonly Finding[]): string {
  const counts = FAMILIES.map(([key, name]) => ({ key, name, n: findings.filter((f) => f.group === key).length }))
  const most = Math.max(1, ...counts.map((c) => c.n))
  return counts.map(({ key, name, n }) =>
    `<div class="fam" data-family="${key}"><span>${name}</span><span class="track"><b style="width:${n3((n / most) * 100)}%"></b></span><span class="n">${n}</span></div>`).join('')
}

export function renderHero(result: AuditResult, groups: readonly Finding[][], ruleCount: number): string {
  const errors = groups.filter((g) => g[0]!.severity === 'error').length
  const warnings = groups.filter((g) => g[0]!.severity === 'warning').length
  const v = verdict(errors, warnings)
  const detail = v.detail || `All ${ruleCount} rules pass on this screen.`
  const unreadable = result.unreadableStylesheets > 0
    ? `<p class="notice">${plural(result.unreadableStylesheets, 'stylesheet', 'stylesheets')} could not be read, so layout checks may miss rules in them.</p>`
    : ''
  return `<section class="hero"><div class="lead"><p class="score" aria-label="Score ${result.score} out of 100">${result.score}<small>/100</small></p><h1 class="verdict">${v.lead} <span>${detail}</span></h1>${unreadable}</div>
<div class="tally"><p class="counts"><span><i class="dot error"></i>${plural(errors, 'rule', 'rules')} failing</span><span><i class="dot warning"></i>${plural(warnings, 'rule', 'rules')} to check</span></p><div class="fams">${familyBars(result.findings)}</div></div></section>`
}
