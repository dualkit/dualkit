// Pure helpers that turn a bench month into what the /bench page shows.
import type { BenchCell, BenchFinding, BenchModel, BenchMonth } from './bench-schema'

/** Every model builds every screen alone and with Dualkit, three times each (packages/bench RUN.runs). */
const CONDITIONS = 2
const RUNS = 3
export const PROGRESS_TICKS = 30
/** Screenshots are taken at this many CSS px wide. */
export const SHOT_W = 390
const SAME_BOX_PX = 2
const RING_PAD = 4
const PIN_GAP = 8
const PIN = 18
const PIN_STEP = 2
/** The narrowest side a shot is shown at, as a share of its 390 px, so pins placed past a ring always fit. */
const MIN_ZOOM = 0.8

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
export function movementOf(m: BenchModel): Movement {
  if (m.rank === null) return { kind: 'level' }
  if (m.previousRank === null) return { kind: 'new' }
  const d = m.previousRank - m.rank
  return d === 0 ? { kind: 'level' } : { kind: d > 0 ? 'up' : 'down', n: Math.abs(d) }
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

/** Pins go just past the ring's inline end, or before its start when they would run off the image. */
export function pinSide(box: Box, count: number): 'end' | 'start' {
  const need = (RING_PAD + PIN_GAP + count * PIN + (count - 1) * PIN_STEP) / MIN_ZOOM
  return SHOT_W - (box.x + box.width) >= need ? 'end' : 'start'
}

export const sideLine = (c: Extract<BenchCell, { ran: true }>, ruleCount: number) => `${c.rulesPassed} of ${ruleCount} rules · score ${c.score}`

export function tickFill(done: number, total: number, ticks = PROGRESS_TICKS) {
  const r = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0
  return { filled: Math.round(r * ticks), percent: Math.round(r * 100) }
}

export const rawUrl = (path: string) => `${REPO_BLOB}/${path}`
export const makerInitial = (by: string) => by.trim().charAt(0).toUpperCase() || '?'
