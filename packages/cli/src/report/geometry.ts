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

/** A window centred on the box, wide enough for it plus room each side, clamped inside the image. */
export function cropWindow(box: Box, imageWidth: number, imageHeight: number): Box {
  const width = Math.min(imageWidth, Math.max(CROP_MIN_WIDTH, box.width + 2 * CROP_SIDE))
  const height = Math.min(imageHeight, Math.max(width / CROP_ASPECT, box.height + 2 * CROP_MIN_VERTICAL))
  const x = clamp(box.x + box.width / 2 - width / 2, 0, imageWidth - width)
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
