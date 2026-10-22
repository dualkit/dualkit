// Evidence cards: one per rule, a zoomed crop of the first instance, the fix, and every other instance.
import type { Finding } from '@dualkit/rules'
import { escapeHtml } from '../escape'
import { renderMessage } from '../quote'
import { cropWindow, mergeMarks, settleEdges, type Box } from './geometry'
import { renderView, type ViewContext } from './view'

export type Numbered = { n: number; f: Finding }
export type RuleGroup = { all: Finding[]; shown: Numbered[] }

const SEVERITY_LABEL: Record<Finding['severity'], string> = { error: 'Must fix', warning: 'Worth checking', note: 'Note' }
/** Narrowest rendered width of a card crop (a 390px phone) and of an instance crop inside the disclosure. */
const CARD_CROP_MIN_PX = 320
const INSTANCE_CROP_MIN_PX = 260

/** The element box when it is on the captured screenshot; null for page-level findings and boxes below it. */
export function visibleBox(f: Finding, ctx: ViewContext): Box | null {
  const b = f.node?.box
  if (!b || b.y >= ctx.imageHeight || b.x >= ctx.imageWidth || b.x + b.width <= 0 || b.width <= 0 || b.height <= 0) return null
  return b
}

const PAGE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.75" y="1.75" width="10.5" height="12.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
const safeHref = (url: string) => (/^https:\/\//.test(url) ? escapeHtml(url) : null)
const message = (f: Finding) => `<bdi dir="ltr">${renderMessage(f.message)}</bdi>`
const snippet = (f: Finding) => (f.node ? `<code dir="ltr">${escapeHtml(f.node.snippet)}</code>` : '')

/** Marks a finding that came from the vision model, with how sure it was. */
const reviewBadge = (f: Finding) => (f.source === 'review' ? `<span class="badge">Review${f.confidence === undefined ? '' : ` · ${Math.round(f.confidence * 100)}% sure`}</span>` : '')

function crop({ n, f }: Numbered, box: Box, ctx: ViewContext, minPx: number, cls: string): string {
  const rough = cropWindow(box, ctx.imageWidth, ctx.imageHeight)
  const content = ctx.paint?.contentSpan(rough.y, rough.y + rough.height) ?? null
  const framed = cropWindow(box, ctx.imageWidth, ctx.imageHeight, content)
  const win = ctx.paint ? settleEdges(framed, box, ctx.imageWidth, ctx.imageHeight, ctx.paint.isClear) : framed
  return renderView({
    win,
    marks: mergeMarks([{ n, box, severity: f.severity }]),
    bands: [minPx],
    label: `Finding ${n} on the screen`,
    className: cls,
  }, ctx)
}

/** What stands in for the crop when there is nothing on the screenshot to point at. */
function pageLevel({ n, f }: Numbered): string {
  const where = f.node ? 'Below the captured part of the screen' : 'Applies to the whole page'
  return `<div class="page-level"><p class="where">${PAGE_ICON}${where}</p><p class="said" id="i${n}">${message(f)}</p></div>`
}

function instance(item: Numbered, ctx: ViewContext): string {
  const box = visibleBox(item.f, ctx)
  return `<li id="i${item.n}"><span class="pin-static ${item.f.severity}">${item.n}</span><div class="what"><p>${message(item.f)}</p>${snippet(item.f)}${box ? crop(item, box, ctx, INSTANCE_CROP_MIN_PX, 'crop small') : ''}</div></li>`
}

function more(group: RuleGroup, ctx: ViewContext): string {
  const rest = group.shown.slice(1)
  if (group.all.length < 2) return ''
  const hidden = group.all.length - group.shown.length
  const tail = hidden > 0 ? `<p class="notice">And ${hidden} more.</p>` : ''
  const chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  return `<details><summary>${chevron}${group.all.length - 1} more like this</summary><ol class="instances">${rest.map((i) => instance(i, ctx)).join('')}</ol>${tail}</details>`
}

export function renderCard(group: RuleGroup, ctx: ViewContext): string {
  const first = group.shown[0]!
  const f = first.f
  const box = visibleBox(f, ctx)
  const evidence = box ? crop(first, box, ctx, CARD_CROP_MIN_PX, 'crop') : pageLevel(first)
  const seen = box ? `<div class="seen" id="i${first.n}"><p>${message(f)}</p>${snippet(f)}</div>` : ''
  const href = safeHref(f.docs)
  const why = href ? ` <a class="why" href="${href}">Why</a>` : ''
  return `<article class="card ev ${f.severity}">${evidence}<div class="body">
<p class="head"><span class="pin-static ${f.severity}">${first.n}</span><span>${SEVERITY_LABEL[f.severity]}</span><span class="rid">${escapeHtml(f.rule)}</span>${reviewBadge(f)}</p>
<h3>${escapeHtml(f.title)}</h3><p class="fix">${escapeHtml(f.fix)}${why}</p>${seen}${more(group, ctx)}</div></article>`
}
