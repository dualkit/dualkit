// Page-space geometry for the report: crop windows over the screenshot and the rings drawn on them.
import type { Finding } from '@dualkit/rules'

export type Box = { x: number; y: number; width: number; height: number }
export type Severity = Finding['severity']
export type Mark = { box: Box; numbers: number[]; label: string; severity: Severity }

/** The narrowest crop: at about 1.6x in a card this keeps a label and its neighbours readable. */
export const CROP_MIN_WIDTH = 360
const CROP_SIDE = 60
const CROP_ASPECT = 2.4
const CROP_MIN_VERTICAL = 32
/** Boxes this alike are one element (or its wrapper), so their findings share a ring. */
const SAME_BOX_IOU = 0.6

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const RANK: Record<Severity, number> = { error: 0, warning: 1, note: 2 }
export const bySeverity = (a: Severity, b: Severity): number => RANK[a] - RANK[b]

export type Span = { x0: number; x1: number }

/**
 * A window centred on the box, wide enough for it plus room each side, clamped inside the image.
 * Given the span the page's content covers, the window moves inside it first, so it is never mostly page background.
 */
export function cropWindow(box: Box, imageWidth: number, imageHeight: number, content?: Span | null): Box {
  const width = Math.min(imageWidth, Math.max(CROP_MIN_WIDTH, box.width + 2 * CROP_SIDE))
  const height = Math.min(imageHeight, Math.max(width / CROP_ASPECT, box.height + 2 * CROP_MIN_VERTICAL))
  let x = box.x + box.width / 2 - width / 2
  if (content) {
    const lo = Math.min(content.x0, box.x)
    const hi = Math.max(content.x1, box.x + box.width)
    x = hi - lo >= width ? clamp(x, lo, hi - width) : (lo + hi) / 2 - width / 2
  }
  x = clamp(x, 0, imageWidth - width)
  const y = clamp(box.y + box.height / 2 - height / 2, 0, imageHeight - height)
  return { x, y, width, height }
}

/** The union of the boxes plus a margin, clamped to the image; the whole image when there are none. */
export function contentWindow(boxes: readonly Box[], imageWidth: number, imageHeight: number, margin: number): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: imageWidth, height: imageHeight }
  const x0 = clamp(Math.min(...boxes.map((b) => b.x)) - margin, 0, imageWidth)
  const y0 = clamp(Math.min(...boxes.map((b) => b.y)) - margin, 0, imageHeight)
  const x1 = clamp(Math.max(...boxes.map((b) => b.x + b.width)) + margin, 0, imageWidth)
  const y1 = clamp(Math.max(...boxes.map((b) => b.y + b.height)) + margin, 0, imageHeight)
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }
}

/** The part of a box inside the window, or null when none of it is. */
export function clip(box: Box, win: Box): Box | null {
  const x0 = Math.max(box.x, win.x)
  const y0 = Math.max(box.y, win.y)
  const x1 = Math.min(box.x + box.width, win.x + win.width)
  const y1 = Math.min(box.y + box.height, win.y + win.height)
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null
}

/** A box as percentages of the window, so it stays on its element at every rendered size. */
export function ringPercent(box: Box, win: Box): { left: number; top: number; width: number; height: number } {
  return {
    left: ((box.x - win.x) / win.width) * 100,
    top: ((box.y - win.y) / win.height) * 100,
    width: (box.width / win.width) * 100,
    height: (box.height / win.height) * 100,
  }
}

const area = (b: Box) => b.width * b.height
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

export function nearlySame(a: Box, b: Box): boolean {
  const both = clip(a, b)
  if (!both) return false
  return area(both) / (area(a) + area(b) - area(both)) >= SAME_BOX_IOU
}

/** One ring per element: findings on nearly the same box merge, labelled with every number they carry. */
export function mergeMarks(items: ReadonlyArray<{ n: number; box: Box; severity: Severity }>): Mark[] {
  const groups: Array<Array<{ n: number; box: Box; severity: Severity }>> = []
  for (const item of items) {
    const home = groups.find((g) => g.some((o) => nearlySame(o.box, item.box)))
    if (home) home.push(item)
    else groups.push([item])
  }
  return groups.map((g) => {
    const numbers = g.map((i) => i.n).sort((a, b) => a - b)
    return {
      box: g.map((i) => i.box).reduce(union),
      numbers,
      label: numbers.join('·'),
      severity: g.map((i) => i.severity).sort(bySeverity)[0]!,
    }
  })
}

/** The window with page background trimmed off its sides, keeping a margin and every box whole. */
export function narrowToContent(win: Box, content: Span | null, margin: number, boxes: readonly Box[]): Box {
  if (!content) return win
  const x0 = Math.min(Math.max(win.x, content.x0 - margin), ...boxes.map((b) => b.x))
  const x1 = Math.max(Math.min(win.x + win.width, content.x1 + margin), ...boxes.map((b) => b.x + b.width))
  return { ...win, x: x0, width: x1 - x0 }
}

/** How far a crop may slide to find edges that do not cut through text, and the room kept around its element. */
const SETTLE_REACH = 96
const SETTLE_STEP = 4
const SETTLE_ROOM = 24

/** Offsets nearest first: 0, +s, -s, +2s, -2s ... */
const offsets = () => [0, ...Array.from({ length: SETTLE_REACH / SETTLE_STEP }, (_, i) => [(i + 1) * SETTLE_STEP, -(i + 1) * SETTLE_STEP]).flat()]

/**
 * Slides a crop so its edges fall on clear page, not through a word, while its element stays in view
 * with room around it. Each axis moves independently; an axis with no clean cut stays where it was.
 */
export function settleEdges(win: Box, box: Box, imageWidth: number, imageHeight: number, isClear: (r: Box) => boolean): Box {
  const fits = (lo: number, size: number, max: number, elLo: number, elSize: number) =>
    lo >= 0 && lo + size <= max && elLo >= lo + Math.min(SETTLE_ROOM, (size - elSize) / 2) - 0.01 && elLo + elSize <= lo + size - Math.min(SETTLE_ROOM, (size - elSize) / 2) + 0.01
  const dx = offsets().find((d) => {
    const x = win.x + d
    return fits(x, win.width, imageWidth, box.x, box.width)
      && isClear({ x, y: win.y, width: 1, height: win.height })
      && isClear({ x: x + win.width - 1, y: win.y, width: 1, height: win.height })
  })
  const x = win.x + (dx ?? 0)
  const dy = offsets().find((d) => {
    const y = win.y + d
    return fits(y, win.height, imageHeight, box.y, box.height)
      && isClear({ x, y, width: win.width, height: 1 })
      && isClear({ x, y: y + win.height - 1, width: win.width, height: 1 })
  })
  return { ...win, x, y: win.y + (dy ?? 0) }
}
