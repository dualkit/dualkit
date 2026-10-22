// The Gulf-ready HTML report: a score and verdict, one evidence card per rule, and the whole screen.
import { RULES, type Finding } from '@dualkit/rules'
import type { AuditResult } from './audit'
import { escapeHtml } from './escape'
import { groupByRule } from './summary'
import { renderCard, visibleBox, type Numbered, type RuleGroup } from './report/cards'
import { bySeverity, contentWindow, mergeMarks, narrowToContent, type Box } from './report/geometry'
import { renderHeader, renderHero } from './report/hero'
import { paintMap } from './report/paint'
import { styles } from './report/styles'
import { WIDE_VIEW_PX, renderView, type ViewContext } from './report/view'

export const MAX_PER_RULE = 20
export { escapeHtml } from './escape'

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/
const DUALKIT_URL = 'https://dualkit.dev'
const RULES_URL = 'https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md'
/** The whole-screen view must read on a 390px phone; past WIDE_VIEW_PX it switches to roomier pins. */
const WHOLE_MIN_PX = 340
const WHOLE_MARGIN = 56
/** Page background kept either side of the content in the whole-screen view. */
const WHOLE_SIDE_MARGIN = 24

/** Rules in severity order, each with its first MAX_PER_RULE instances numbered 1, 2, 3 down the report. */
function numberGroups(findings: readonly Finding[]): RuleGroup[] {
  const groups = [...groupByRule(findings)].sort((a, b) => bySeverity(a[0]!.severity, b[0]!.severity))
  let n = 0
  return groups.map((all) => ({ all, shown: all.slice(0, MAX_PER_RULE).map((f) => ({ n: ++n, f })) }))
}

function viewContext(result: AuditResult, screenshot: string): ViewContext {
  const ctx = { imageWidth: result.width, imageHeight: result.pageHeight }
  // Null when the PNG is not a whole-number multiple of the page the boxes were measured on.
  const paint = screenshot ? paintMap(screenshot, result.width, result.pageHeight) : null
  return paint ? { ...ctx, paint } : ctx
}

function wholeScreen(numbered: readonly Numbered[], ctx: ViewContext): string {
  const marks = mergeMarks(numbered.flatMap(({ n, f }) => {
    const box = visibleBox(f, ctx)
    return box ? [{ n, box, severity: f.severity }] : []
  }))
  const boxes: Box[] = marks.map((m) => m.box)
  const framed = contentWindow(boxes, ctx.imageWidth, ctx.imageHeight, WHOLE_MARGIN)
  const content = ctx.paint?.contentSpan(framed.y, framed.y + framed.height) ?? null
  const win = narrowToContent(framed, content, WHOLE_SIDE_MARGIN, boxes)
  const view = renderView({ win, marks, bands: [WHOLE_MIN_PX, WIDE_VIEW_PX], label: 'The audited screen with every finding numbered', className: 'whole' }, ctx)
  const lede = marks.length > 0 ? 'Every finding in place. Select a number to jump to it.' : 'The screen as it was checked.'
  return `<section class="full"><h2>The whole screen</h2><p class="lede">${lede}</p><div class="card stage">${view}</div></section>`
}

/** `reviewFindings` get their own cards, marked as review. The score, verdict and tallies count the check findings only. */
export function renderReport(result: AuditResult, reviewFindings: readonly Finding[] = []): string {
  const screenshot = BASE64.test(result.screenshot) ? result.screenshot : ''
  const ctx = viewContext(result, screenshot)
  const groups = numberGroups([...result.findings, ...reviewFindings])
  const firsts = groupByRule(result.findings)
  const cards = groups.length > 0
    ? `<section class="grid">${groups.map((g) => renderCard(g, ctx)).join('')}</section>`
    : `<section class="card clean"><p>No issues found.</p><p>This screen is Gulf-ready by every Dualkit rule.</p></section>`
  const shotUrl = screenshot ? `url(data:image/png;base64,${screenshot})` : 'none'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dualkit check report</title><style>${styles(shotUrl)}</style></head><body><main class="wrap">
${renderHeader(result, RULES.length)}
${renderHero(result, firsts, RULES.length)}
${cards}
${wholeScreen(groups.flatMap((g) => g.shown), ctx)}
<footer class="foot"><p>Made with <a href="${DUALKIT_URL}">Dualkit</a></p><p>Every rule is explained in <a href="${RULES_URL}">RULES.md</a></p></footer>
</main></body></html>`
}
