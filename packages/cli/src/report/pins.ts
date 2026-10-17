// Pin placement: every pin sits outside its ring, in clear space, never over another pin or ring.
import type { Box, Mark } from './geometry'

export type Placement = { rect: Box; leader: boolean }
export type PinOptions = {
  /** Pin height in page pixels. */
  pinHeight: number
  /** Room kept between a ring's element box and anything else, in page pixels. */
  gap: number
  /** True when the page has painted nothing inside the rectangle. Defaults to always clear. */
  isClear?: (r: Box) => boolean
}

const PIN_STACK_GAP = 4
const MAX_STEPS_OUT = 14
const SIDES = ['end', 'start', 'above', 'below'] as const
type Side = (typeof SIDES)[number]

/** A pin is a circle for one or two digits and a capsule for longer labels such as 3·16. */
export function pinSize(label: string, height: number): { width: number; height: number } {
  const chars = [...label].length
  const width = chars <= 2 ? height : height * (0.33 * chars + 0.4)
  return { width: Math.round(width * 100) / 100, height }
}

/** Strict overlap with a hair of tolerance, so a pin touching a ring's reserved edge is not a collision. */
const EPS = 0.01
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS
const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by })
const inside = (r: Box, win: Box) => r.x >= win.x && r.y >= win.y && r.x + r.width <= win.x + win.width && r.y + r.height <= win.y + win.height

/** Offsets along a side, nearest first: 0, +s, -s, +2s, -2s ... */
function sweep(reach: number, step: number): number[] {
  const out = [0]
  for (let d = step; d <= reach; d += step) out.push(d, -d)
  return out
}

function candidates(box: Box, side: Side, distance: number, w: number, h: number): Box[] {
  const step = h / 3
  if (side === 'end' || side === 'start') {
    const x = side === 'end' ? box.x + box.width + distance : box.x - distance - w
    const cy = box.y + box.height / 2 - h / 2
    return sweep(box.height / 2 + 4 * h, step).map((o) => ({ x, y: cy + o, width: w, height: h }))
  }
  const y = side === 'above' ? box.y - distance - h : box.y + box.height + distance
  const x0 = box.x + box.width - w
  return sweep(box.width + 4 * w, step).map((o) => ({ x: x0 - o, y, width: w, height: h }))
}

/** Touching its ring: on the side's first step and level with the box along that side. */
function adjacent(r: Box, box: Box, side: Side, step: number): boolean {
  if (step > 0) return false
  return side === 'end' || side === 'start'
    ? r.y < box.y + box.height && r.y + r.height > box.y
    : r.x < box.x + box.width && r.x + r.width > box.x
}

function placeOne(mark: Mark, win: Box, rings: Box[], pins: Box[], opts: PinOptions, usePixels: boolean): Placement | null {
  const { width: w, height: h } = pinSize(mark.label, opts.pinHeight)
  const free = (r: Box) => inside(r, win)
    && !rings.some((o) => overlaps(r, o))
    && !pins.some((p) => overlaps(r, grow(p, PIN_STACK_GAP / 2)))
    && (!usePixels || (opts.isClear?.(r) ?? true))
  // Level with the ring on any side beats sliding along the preferred one; sliding beats moving out.
  for (const side of SIDES) {
    const hit = candidates(mark.box, side, opts.gap, w, h).find((r) => adjacent(r, mark.box, side, 0) && free(r))
    if (hit) return { rect: hit, leader: false }
  }
  for (let step = 0; step <= MAX_STEPS_OUT; step++) {
    const distance = opts.gap + step * (h / 2)
    for (const side of SIDES) {
      const hit = candidates(mark.box, side, distance, w, h).find(free)
      if (hit) return { rect: hit, leader: !adjacent(hit, mark.box, side, step) }
    }
  }
  return null
}

/**
 * Places pins in order. It tries clear page space first; on a page too busy for that it settles for
 * space clear of rings and pins, and as a last resort the inline-end side of the ring.
 */
export function placePins(marks: readonly Mark[], win: Box, opts: PinOptions): Placement[] {
  const rings = marks.map((m) => grow(m.box, opts.gap))
  const placed: Placement[] = []
  for (const mark of marks) {
    const pins = placed.map((p) => p.rect)
    const { width: w, height: h } = pinSize(mark.label, opts.pinHeight)
    const fallback = { rect: { x: Math.min(mark.box.x + mark.box.width + opts.gap, win.x + win.width - w), y: mark.box.y, width: w, height: h }, leader: false }
    placed.push(placeOne(mark, win, rings, pins, opts, true) ?? placeOne(mark, win, rings, pins, opts, false) ?? fallback)
  }
  return placed
}
