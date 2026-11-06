import { RULES, runRules, type Finding } from '@dualkit/rules'
import { JSDOM_CHECKED, JSDOM_NOT_CHECKED, UNCLASSIFIED } from './jsdom-coverage'
import { readHtml } from './jsdom-screen'

const checkedSet = new Set(JSDOM_CHECKED)
export const CHECKED = RULES.filter((r) => checkedSet.has(r.id))
export const NOT_CHECKED = RULES.filter((r) => !checkedSet.has(r.id)).map((r) => ({ rule: r.id, reason: JSDOM_NOT_CHECKED[r.id] ?? UNCLASSIFIED }))

export type CheckedFinding = Omit<Finding, 'node'> & { node: { id: string; snippet: string } | null }

/** The box is jsdom's placeholder, not a measurement, so findings name the element by id and snippet only. */
const withoutBox = ({ node, ...f }: Finding): CheckedFinding => ({ ...f, node: node && { id: node.id, snippet: node.snippet } })

/** Reads the HTML in jsdom and runs the rules jsdom can answer. Synchronous and slow on a large page: run it in a worker. */
export function checkMarkup(html: string): CheckedFinding[] {
  return runRules(readHtml(html), { rules: CHECKED }).map(withoutBox)
}
