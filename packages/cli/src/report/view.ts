// A view: a window onto the single embedded screenshot, with rings and pins drawn in page space.
import { clip, ringPercent, type Box, type Mark } from './geometry'
import { placePins, type Placement } from './pins'
import { escapeHtml } from '../escape'
import type { PaintMap } from './paint'

/** Smallest pin on screen, in css px; pins grow with the view up to PIN_MAX_PX. */
const PIN_MIN_PX = 16
const PIN_MAX_PX = 22
/** Outline offset 3px + outline 1.5px + 3px of air, kept clear around every ring. */
const RING_ROOM_PX = 7.5
/** Wide views carry a second pin layout, used at and above this rendered width (see styles.ts). */
export const WIDE_VIEW_PX = 700
/** Views never draw the screenshot larger than this. */
export const MAX_ZOOM = 2

export type ViewContext = { imageWidth: number; imageHeight: number; paint?: PaintMap }
export type ViewSpec = {
  win: Box
  marks: Mark[]
  /** Narrowest rendered width this view must stay correct at; a second number adds a wide layout. */
  bands: readonly number[]
  label: string
  className: string
}

const n3 = (n: number) => Number(n.toFixed(3)).toString()
const pct = (n: number) => `${n3(Math.max(-50, Math.min(150, n)))}%`

function boxStyle(b: Box, win: Box): string {
  const r = ringPercent(b, win)
  return `left:${pct(r.left)};top:${pct(r.top)};width:${pct(r.width)};height:${pct(r.height)}`
}

/** The point on a ring nearest the pin, for the leader line. */
function nearest(p: { x: number; y: number }, b: Box): { x: number; y: number } {
  return { x: Math.max(b.x, Math.min(b.x + b.width, p.x)), y: Math.max(b.y, Math.min(b.y + b.height, p.y)) }
}

/** Which way the pin hugs inside its reserved slot, so a pin capped smaller still sits by its ring. */
function hug(rect: Box, ring: Box): string {
  if (rect.x >= ring.x + ring.width) return 'hug-s'
  if (rect.x + rect.width <= ring.x) return 'hug-e'
  return rect.y + rect.height <= ring.y ? 'hug-b' : 'hug-t'
}

function pinLayer(spec: ViewSpec, ctx: ViewContext, band: number, cls: string): string {
  const { win, marks } = spec
  const perCss = win.width / band
  const pinHeight = PIN_MIN_PX * perCss
  const gap = RING_ROOM_PX * perCss
  const opts = ctx.paint ? { pinHeight, gap, isClear: ctx.paint.isClear } : { pinHeight, gap }
  const placed: Placement[] = placePins(marks, win, opts)
  const size = `${n3((pinHeight / win.width) * 100)}cqw`
  const lines = placed.map((p, i) => {
    if (!p.leader) return ''
    const c = { x: p.rect.x + p.rect.width / 2, y: p.rect.y + p.rect.height / 2 }
    const e = nearest(c, marks[i]!.box)
    return `<line class="${marks[i]!.severity}" x1="${n3(c.x)}" y1="${n3(c.y)}" x2="${n3(e.x)}" y2="${n3(e.y)}"/>`
  }).join('')
  const svg = lines ? `<svg class="leaders" viewBox="${n3(win.x)} ${n3(win.y)} ${n3(win.width)} ${n3(win.height)}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>` : ''
  const pins = placed.map((p, i) => {
    const m = marks[i]!
    const ratio = n3(p.rect.width / p.rect.height)
    return `<a class="pin ${m.severity}${p.leader ? '' : ` ${hug(p.rect, m.box)}`}" href="#i${m.numbers[0]}" style="${boxStyle(p.rect, win)};--h:min(${PIN_MAX_PX}px,${size});--r:${ratio}"><i>${escapeHtml(m.label)}</i></a>`
  }).join('')
  return `<div class="layer ${cls}">${svg}${pins}</div>`
}

/** Background maths: the image scaled so the window fills the box, then shifted to the window. */
function backdrop(win: Box, ctx: ViewContext): string {
  const { imageWidth: W, imageHeight: H } = ctx
  const px = W > win.width ? (win.x / (W - win.width)) * 100 : 0
  const py = H > win.height ? (win.y / (H - win.height)) * 100 : 0
  return `background-size:${n3((W / win.width) * 100)}% auto;background-position:${n3(px)}% ${n3(py)}%`
}

export function renderView(view: ViewSpec, ctx: ViewContext): string {
  const { win } = view
  const marks = view.marks.flatMap((m) => {
    const b = clip(m.box, win)
    return b ? [{ ...m, box: b }] : []
  })
  const spec = { ...view, marks }
  const rings = marks.map((m) => `<span class="ring ${m.severity}" style="${boxStyle(m.box, win)}"></span>`).join('')
  const [narrow, wide] = spec.bands
  const layers = narrow === undefined || marks.length === 0 ? ''
    : wide === undefined ? pinLayer(spec, ctx, narrow, 'all')
      : pinLayer(spec, ctx, narrow, 'narrow') + pinLayer(spec, ctx, wide, 'wide')
  const style = `aspect-ratio:${n3(win.width)}/${n3(win.height)};max-width:${n3(win.width * MAX_ZOOM)}px;${backdrop(win, ctx)}`
  return `<div class="view ${spec.className}" role="group" aria-label="${escapeHtml(spec.label)}" style="${style}">${rings}${layers}</div>`
}
