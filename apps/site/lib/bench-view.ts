// Pure helpers that turn a bench month into what the /bench page shows.
import type { BenchCell, BenchFinding, BenchModel, BenchMonth } from './bench-schema'
import { MAKER_MARKS, type MakerMark } from './marks'

/** Every model builds every screen alone and with Dualkit, three times each (packages/bench RUN.runs). */
const CONDITIONS = 2
const RUNS = 3
export const PROGRESS_TICKS = 30
/** Screenshots are taken at this many CSS px wide. */
export const SHOT_W = 390
const SAME_BOX_PX = 2
/** Ring padding around a finding box, and the pin geometry, in screen px. */
export const RING_PAD = 4
const PIN_GAP = 8
const PIN = 18
const PIN_STEP = 2
const PIN_ABOVE = 4
const NUDGE = 20
const CORNER = 12
const DEFAULT_OUT_OF = 100
/** Pins may graze a ring or another pin by this much; sub-pixel scaling should not push them away. */
const GRAZE = 2

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const REPO_BLOB = 'https://github.com/dualkit/dualkit/blob/main'
const NO_REASON = 'Fewer than two of three runs came back.'

export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
export const factsLine = ({ models, screens }: { models: number; screens: number }) =>
  `${plural(models, 'model')} · ${plural(screens, 'screen')} · ${plural(models * screens * CONDITIONS * RUNS, 'build')}`
export const factsOf = (m: BenchMonth) => ({ models: m.models.length, screens: new Set(m.models.flatMap((x) => x.screens.map((s) => s.id))).size })

export type Movement = { kind: 'new' } | { kind: 'level' } | { kind: 'up' | 'down'; n: number }
/** From the summary's move, not previousRank: a model removed or added between months would shift every rank below it. */
export function movementOf(m: BenchModel): Movement {
  if (m.isNew) return { kind: 'new' }
  if (m.move === null || m.move === 0) return { kind: 'level' }
  return { kind: m.move > 0 ? 'up' : 'down', n: Math.abs(m.move) }
}

const share = (t: { rulesPassed: number; outOf: number }) => (t.outOf > 0 ? Math.min(100, Math.max(0, (t.rulesPassed / t.outOf) * 100)) : 0)
/** Where the two points sit on the 0 to 100 track. */
export const trackOf = (m: BenchModel) => (m.alone && m.dualkit ? { alone: share(m.alone), dualkit: share(m.dualkit) } : null)

export function unrankedReason(m: BenchModel): string {
  for (const s of m.screens) for (const c of [s.alone, s.dualkit]) if (!c.ran && c.reasons[0]) return c.reasons[0]
  return NO_REASON
}
export const cellReason = (c: Extract<BenchCell, { ran: false }>) => c.reasons[0] ?? NO_REASON

type Box = NonNullable<BenchFinding['box']>
export type ShotMarks = {
  items: { n: number; rule: string; title: string; wholePage: boolean }[]
  rings: { box: Box; numbers: number[] }[]
  /** Numbers for rules with no box at all, pinned in the image's top-end corner. */
  corner: number[]
}

const near = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) <= SAME_BOX_PX && Math.abs(a.y - b.y) <= SAME_BOX_PX &&
  Math.abs(a.x + a.width - (b.x + b.width)) <= SAME_BOX_PX && Math.abs(a.y + a.height - (b.y + b.height)) <= SAME_BOX_PX
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

/** One number per distinct rule in list order, one ring per distinct box (within 2px), and the page-level pins. */
export function shotMarks(findings: readonly BenchFinding[]): ShotMarks {
  const order = [...new Set(findings.map((f) => f.rule))]
  const numberOf = (rule: string) => order.indexOf(rule) + 1
  const boxed = new Set(findings.filter((f) => f.box).map((f) => f.rule))
  const items = order.map((rule, k) => ({ n: k + 1, rule, title: findings.find((f) => f.rule === rule)?.title ?? rule, wholePage: !boxed.has(rule) }))
  const rings = findings.reduce<ShotMarks['rings']>((acc, f) => {
    if (!f.box) return acc
    const n = numberOf(f.rule)
    const k = acc.findIndex((r) => near(r.box, f.box!))
    if (k < 0) return [...acc, { box: f.box, numbers: [n] }]
    const r = acc[k]!
    const merged = { box: union(r.box, f.box), numbers: r.numbers.includes(n) ? r.numbers : [...r.numbers, n].sort((a, b) => a - b) }
    return acc.map((x, i) => (i === k ? merged : x))
  }, [])
  return { items, rings, corner: items.filter((i) => i.wholePage).map((i) => i.n) }
}

export type PinSpot = { left: number; top: number; width: number }
type Rect = { x: number; y: number; w: number; h: number }
const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const shrink = (r: Rect): Rect => ({ x: r.x + GRAZE / 2, y: r.y + GRAZE / 2, w: r.w - GRAZE, h: r.h - GRAZE })
/** A pin group's box, shrunk by half the graze allowance on every side. */
const spotRect = (p: PinSpot): Rect => ({ x: p.left + GRAZE / 2, y: p.top + GRAZE / 2, w: p.width - GRAZE, h: PIN - GRAZE })
const groupWidth = (n: number) => n * PIN + Math.max(0, n - 1) * PIN_STEP

/**
 * Where each ring's pins go on a shot shown `width` px wide, in px from the shot's top-start corner.
 * Past the ring's inline end when that is free and inside the image; else before its start; else above it;
 * and when no spot is free, the one that covers least of the other rings.
 * Then any pin that would sit on a pin already placed steps down 20px at a time.
 */
export function placePins(rings: ShotMarks['rings'], corner: readonly number[], width: number): { rings: PinSpot[]; corner: PinSpot | null } {
  const k = width / SHOT_W
  const rects: Rect[] = rings.map(({ box }) => ({ x: box.x * k - RING_PAD, y: box.y * k - RING_PAD, w: box.width * k + RING_PAD * 2, h: box.height * k + RING_PAD * 2 }))
  const cornerSpot = corner.length ? { left: width - CORNER - groupWidth(corner.length), top: CORNER, width: groupWidth(corner.length) } : null
  const placed: Rect[] = cornerSpot ? [spotRect(cornerSpot)] : []
  const spots = rings.map((r, i) => {
    const R = rects[i]!
    const w = groupWidth(r.numbers.length)
    const mid = R.y + R.h / 2 - PIN / 2
    const clampX = (x: number) => Math.min(Math.max(x, 0), Math.max(0, width - w))
    // In order of preference: past the end, before the start, above. Each must sit inside the image.
    const candidates: PinSpot[] = [
      { left: R.x + R.w + PIN_GAP, top: mid, width: w },
      { left: R.x - PIN_GAP - w, top: mid, width: w },
      { left: clampX(R.x), top: Math.max(0, R.y - PIN_ABOVE - PIN), width: w },
    ].filter((c) => c.left >= 0 && c.left + w <= width)
    const covered = (c: PinSpot) => rects.reduce((sum, o, j) => sum + (j === i ? 0 : overlapArea(spotRect(c), shrink(o))), 0)
    // The first free spot wins; failing that, the one that covers least of the other rings.
    let spot = candidates.find((c) => covered(c) === 0)
      ?? candidates.reduce<PinSpot | null>((best, c) => (!best || covered(c) < covered(best) ? c : best), null)
      ?? { left: clampX(R.x), top: Math.max(0, R.y - PIN_ABOVE - PIN), width: w }
    while (placed.some((p) => hits(spotRect(spot), p))) spot = { ...spot, top: spot.top + NUDGE }
    placed.push(spotRect(spot))
    return spot
  })
  return { rings: spots, corner: cornerSpot }
}

/** A maker's mark by id, ignoring anything that only exists on Object.prototype (ids come from fetched files). */
export const makerMarkOf = (id: string): MakerMark | null => (Object.hasOwn(MAKER_MARKS, id) ? MAKER_MARKS[id]! : null)

/** What the totals are out of, from the first model that has one. */
export function benchOutOf(m: BenchMonth): number {
  for (const x of m.models) { const t = x.alone ?? x.dualkit; if (t) return t.outOf }
  return DEFAULT_OUT_OF
}
export const scaleLabels = (outOf: number) => [0, 1, 2, 3, 4].map((q) => String(Math.round((outOf * q) / 4)))

export const sideLine = (c: Extract<BenchCell, { ran: true }>, ruleCount: number) => `${c.rulesPassed} of ${ruleCount} rules · score ${c.score}`

export function tickFill(done: number, total: number, ticks = PROGRESS_TICKS) {
  const r = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0
  return { filled: Math.round(r * ticks), percent: Math.round(r * 100) }
}

export const rawUrl = (path: string) => `${REPO_BLOB}/${path}`
export const makerInitial = (by: string) => by.trim().charAt(0).toUpperCase() || '?'
