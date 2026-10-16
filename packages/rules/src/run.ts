import type { ScreenModel } from './model'
import type { Finding, Rule, Severity } from './rule'
import { RULES } from './rules'

export const WEIGHT: Record<Severity, number> = { error: 10, warning: 4, note: 1 }
/** One rule repeated across a page costs at most three instances, so one habit cannot zero the score. */
export const PER_RULE_CAP = 3
const ORDER: Record<Severity, number> = { error: 0, warning: 1, note: 2 }

export const docsUrl = (ruleId: string): string =>
  `https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#${ruleId.replace(/[^a-z0-9]+/g, '-')}`

export function runRules(model: ScreenModel, options: { ignore?: readonly string[]; rules?: readonly Rule[] } = {}): Finding[] {
  const ignore = new Set(options.ignore ?? [])
  return (options.rules ?? RULES)
    .filter((rule) => !ignore.has(rule.id))
    .flatMap((rule) =>
      rule.check(model).map((hit) => ({
        rule: rule.id, group: rule.group, severity: rule.severity, title: rule.title,
        message: hit.message, fix: rule.fix, docs: docsUrl(rule.id), node: hit.node,
      })),
    )
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.rule.localeCompare(b.rule))
}

export function score(findings: readonly Finding[]): number {
  const counts = new Map<string, { n: number; weight: number }>()
  for (const f of findings) {
    const c = counts.get(f.rule) ?? { n: 0, weight: WEIGHT[f.severity] }
    counts.set(f.rule, { ...c, n: c.n + 1 })
  }
  let lost = 0
  for (const c of counts.values()) lost += c.weight * Math.min(c.n, PER_RULE_CAP)
  return Math.max(0, 100 - lost)
}
