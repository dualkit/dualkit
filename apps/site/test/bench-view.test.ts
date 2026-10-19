import { describe, expect, it } from 'vitest'
import type { BenchCell, BenchFinding, BenchModel, BenchMonth } from '../lib/bench-schema'
import { MAKER_MARKS } from '../lib/marks'
import { benchOutOf, monthAlternates, factsLine, factsOf, makerInitial, makerMarkOf, monthLabel, movementOf, placePins, rawUrl, scaleLabels, shotMarks, sideLine, tickFill, trackOf, unrankedReason } from '../lib/bench-view'

const total = (rulesPassed: number) => ({ rulesPassed, outOf: 100, score: rulesPassed })
type Ran = Extract<BenchCell, { ran: true }>
const ranCell = (over: Partial<Ran> = {}): Ran => ({ ran: true, runs: 3, rulesPassed: 14, score: 30, missing: [], findings: [], shot: null, pageHeight: 844, raw: 'bench/runs/2026-11/a/b/alone-2.json', ...over })
const model = (over: Partial<BenchModel> = {}): BenchModel => ({
  id: 'm', label: 'M', provider: 'gemini', by: 'Google', mark: 'google', rank: 2, previousRank: 3, move: 1, isNew: false,
  alone: total(61), dualkit: total(92), lift: 31, screens: [{ id: 's', title: 'S', alone: ranCell(), dualkit: ranCell() }], ...over,
})

describe('monthLabel', () => {
  it('spells the month out', () => {
    expect(monthLabel('2026-11')).toBe('November 2026')
    expect(monthLabel('2027-01')).toBe('January 2027')
  })
})

describe('facts', () => {
  it('counts models, screens and builds (two ways, three runs each)', () => {
    expect(factsLine({ models: 6, screens: 5 })).toBe('6 models · 5 screens · 180 builds')
    expect(factsLine({ models: 1, screens: 1 })).toBe('1 model · 1 screen · 6 builds')
  })
  it('reads them off a month', () => {
    const m: BenchMonth = { month: '2026-11', generatedAt: 'x', ruleCount: 20, models: [model(), model({ id: 'n' })] }
    expect(factsOf(m)).toEqual({ models: 2, screens: 1 })
  })
})

describe('movementOf', () => {
  it('is new only for a model marked new', () => {
    expect(movementOf(model({ isNew: true, move: null }))).toEqual({ kind: 'new' })
  })
  it('reads move: up, down or level', () => {
    expect(movementOf(model({ move: 1 }))).toEqual({ kind: 'up', n: 1 })
    expect(movementOf(model({ move: -2 }))).toEqual({ kind: 'down', n: 2 })
    expect(movementOf(model({ move: 0 }))).toEqual({ kind: 'level' })
  })
  it('is level when move is null: a returning model that failed last month is not new', () => {
    expect(movementOf(model({ previousRank: null, move: null }))).toEqual({ kind: 'level' })
  })
  it('ignores previousRank, which can count models that were removed', () => {
    expect(movementOf(model({ rank: 1, previousRank: 2, move: 0 }))).toEqual({ kind: 'level' })
  })
  it('is level for an unranked model', () => {
    expect(movementOf(model({ rank: null, previousRank: 1, move: null }))).toEqual({ kind: 'level' })
  })
})

describe('trackOf', () => {
  it('places both points as a share of the total', () => {
    expect(trackOf(model({ alone: { rulesPassed: 30, outOf: 60, score: 0 }, dualkit: { rulesPassed: 45, outOf: 60, score: 0 } }))).toEqual({ alone: 50, dualkit: 75 })
  })
  it('is null for an unranked model', () => {
    expect(trackOf(model({ alone: null }))).toBeNull()
  })
})

describe('unrankedReason', () => {
  it('uses the first reason a cell gives', () => {
    const m = model({ screens: [{ id: 's', title: 'S', alone: ranCell(), dualkit: { ran: false, runs: 0, reasons: ['No HTML in the reply', 'Timed out'] } }] })
    expect(unrankedReason(m)).toBe('No HTML in the reply')
  })
  it('falls back when no cell says why', () => {
    expect(unrankedReason(model({ screens: [{ id: 's', title: 'S', alone: { ran: false, runs: 1, reasons: [] }, dualkit: ranCell() }] }))).toBe('Fewer than two of three runs came back.')
  })
})

const f = (rule: string, box: BenchFinding['box'], title = rule): BenchFinding => ({ rule, title, severity: 'error', box })
const b = (x: number, y: number, width = 40, height = 14) => ({ x, y, width, height })

describe('shotMarks', () => {
  const findings = [
    f('content/missing-dir', null, 'An Arabic page without dir="rtl"'),
    f('layout/ltr', b(24, 112, 151, 14)),
    f('type/tracking', b(24, 44, 98, 27)),
    f('type/tracking', b(25, 113, 150, 13)),
    f('bidi/punct', b(24, 112, 151, 14)),
  ]
  const marks = shotMarks(findings)
  it('numbers one item per distinct rule, in list order', () => {
    expect(marks.items.map((i) => [i.n, i.rule])).toEqual([[1, 'content/missing-dir'], [2, 'layout/ltr'], [3, 'type/tracking'], [4, 'bidi/punct']])
  })
  it('marks a rule with no box as whole page', () => {
    expect(marks.items.map((i) => i.wholePage)).toEqual([true, false, false, false])
    expect(marks.corner).toEqual([1])
  })
  it('merges boxes within 2px into one ring carrying every number', () => {
    expect(marks.rings).toEqual([
      { box: b(24, 112, 151, 14), numbers: [2, 3, 4] },
      { box: b(24, 44, 98, 27), numbers: [3] },
    ])
  })
  it('keeps boxes more than 2px apart separate', () => {
    expect(shotMarks([f('a', b(0, 0)), f('b', b(3, 0))]).rings).toHaveLength(2)
  })
  it('does not put a boxed rule in the corner even when one finding lacks a box', () => {
    expect(shotMarks([f('a', null), f('a', b(0, 0))]).corner).toEqual([])
  })
  it('is empty without findings', () => {
    expect(shotMarks([])).toEqual({ items: [], rings: [], corner: [] })
  })
})

describe('placePins', () => {
  // A side 390 px wide shows the shot at 1:1, so ring boxes are the finding box padded by 4.
  const ring = (box: ReturnType<typeof b>, numbers = [1]) => ({ box, numbers })
  const groupW = (n: number) => n * 18 + (n - 1) * 2
  const overlaps = (a: { left: number; top: number; width: number }, c: { left: number; top: number; width: number }) =>
    a.left < c.left + c.width && c.left < a.left + a.width && a.top < c.top + 18 && c.top < a.top + 18

  it('puts pins just past the ring\'s inline end when there is room', () => {
    const [p] = placePins([ring(b(24, 100, 151, 14), [2, 3])], [], 390).rings
    expect(p).toEqual({ left: 24 + 151 + 4 + 8, top: 100 + 7 - 9, width: groupW(2) })
  })
  it('scales with the side width', () => {
    const [p] = placePins([ring(b(39, 100, 39, 20))], [], 195).rings
    expect(p).toEqual({ left: 19.5 + 19.5 + 4 + 8, top: 50 + 5 - 9, width: 18 })
  })
  it('goes before the ring when the end runs off the image', () => {
    const [p] = placePins([ring(b(300, 100, 80, 14))], [], 390).rings
    expect(p?.left).toBe(300 - 4 - 8 - 18)
  })
  it('goes before the ring when the end would cover another finding\'s ring', () => {
    const { rings } = placePins([ring(b(60, 100, 60, 14), [1]), ring(b(140, 100, 100, 14), [2])], [], 390)
    expect(rings[0]?.left).toBe(60 - 4 - 8 - 18)
  })
  it('goes above the ring when neither side is free', () => {
    const [p] = placePins([ring(b(10, 100, 370, 14))], [], 390).rings
    expect(p).toEqual({ left: 10 - 4, top: 100 - 4 - 4 - 18, width: 18 })
  })
  it('takes the in-bounds spot that covers least of other rings when none is free', () => {
    // From a real alone build at a 320 px phone: past the end clips the ring below by a pixel, above sits on the heading's ring.
    const rings = [ring(b(24, 111.7, 150.6, 14), [2, 3, 4, 6]), ring(b(24, 44.1, 97.9, 27), [3]), ring(b(24, 86.5, 136, 14), [3, 6])]
    const k = 256 / 390
    expect(placePins(rings, [], 256).rings[2]?.left).toBeCloseTo((24 + 136) * k + 4 + 8, 5)
  })
  it('lets pins graze a ring or a pin by under 2px, so rounding never pushes them away', () => {
    // At 256 px wide the [3, 6] pins past their ring touch the pins of the ring below by about a pixel.
    const rings = [ring(b(24, 111.7, 150.6, 14), [2, 3, 4, 6]), ring(b(24, 86.5, 136, 14), [3, 6])]
    const k = 256 / 390
    expect(placePins(rings, [], 256).rings[1]?.top).toBeCloseTo((86.5 + 7) * k - 9, 5)
  })
  it('steps a pin down 20px at a time until it clears pins already placed', () => {
    // Two rings stacked 4px apart: their pins would sit on top of each other.
    const { rings } = placePins([ring(b(24, 100, 100, 10), [1]), ring(b(24, 104, 100, 10), [2])], [], 390)
    expect(rings[1]?.top).toBe(104 + 5 - 9 + 20)
    expect(overlaps(rings[0]!, rings[1]!)).toBe(false)
  })
  it('places the page-level pins in the top-end corner and keeps others clear of them', () => {
    const r = placePins([ring(b(320, 6, 20, 14), [2])], [1], 390)
    expect(r.corner).toEqual({ left: 390 - 12 - 18, top: 12, width: 18 })
    expect(overlaps(r.corner!, r.rings[0]!)).toBe(false)
  })
  it('keeps every pin inside a 320 px phone\'s side', () => {
    const width = 320 - 32 - 32
    const { rings } = placePins([ring(b(24, 44, 340, 27), [1, 2, 3]), ring(b(200, 140, 150, 14), [4, 5])], [], width)
    for (const p of rings) {
      expect(p.left).toBeGreaterThanOrEqual(0)
      expect(p.left + p.width).toBeLessThanOrEqual(width)
    }
  })
})

describe('makerMarkOf', () => {
  it('finds a known mark', () => {
    expect(makerMarkOf('google')?.viewBox).toBe('0 0 24 24')
  })
  it('ignores ids that only exist on the prototype', () => {
    expect(makerMarkOf('constructor')).toBeNull()
    expect(makerMarkOf('__proto__')).toBeNull()
    expect(makerMarkOf('toString')).toBeNull()
  })
})

describe('out of', () => {
  const m = (outOf: number): BenchMonth => ({ month: '2026-11', generatedAt: 'x', ruleCount: 20, models: [model({ alone: null, dualkit: null }), model({ alone: { rulesPassed: 1, outOf, score: 1 } })] })
  it('reads the total from the first model that has one', () => {
    expect(benchOutOf(m(80))).toBe(80)
  })
  it('falls back to 100 with no totals', () => {
    expect(benchOutOf({ ...m(80), models: [] })).toBe(100)
  })
  it('labels the scale in quarters of the total', () => {
    expect(scaleLabels(100)).toEqual(['0', '25', '50', '75', '100'])
    expect(scaleLabels(80)).toEqual(['0', '20', '40', '60', '80'])
    expect(scaleLabels(90)).toEqual(['0', '23', '45', '68', '90'])
  })
})

describe('sideLine', () => {
  it('reads rules and score', () => {
    expect(sideLine(ranCell({ rulesPassed: 14, score: 30 }), 20)).toBe('14 of 20 rules · score 30')
  })
})

describe('tickFill', () => {
  it('fills ticks and a percent from done and total', () => {
    expect(tickFill(112, 180)).toEqual({ filled: 19, percent: 62 })
    expect(tickFill(0, 0)).toEqual({ filled: 0, percent: 0 })
    expect(tickFill(200, 180)).toEqual({ filled: 30, percent: 100 })
  })
})

describe('rawUrl', () => {
  it('links the raw build on GitHub', () => {
    expect(rawUrl('bench/runs/2026-11/a/b/alone-2.json')).toBe('https://github.com/dualkit/dualkit/blob/main/bench/runs/2026-11/a/b/alone-2.json')
  })
})

describe('maker marks', () => {
  it('has a mark for every maker file', () => {
    expect(Object.keys(MAKER_MARKS).sort()).toEqual(['cohere', 'dots-studio', 'google', 'minimax', 'nvidia', 'poolside', 'thinking-machines'])
    for (const m of Object.values(MAKER_MARKS)) {
      expect(m.viewBox).toMatch(/^0 0 \d+ \d+$/)
      expect(m.paths.length).toBeGreaterThan(0)
    }
  })
  it('falls back to the maker initial', () => {
    expect(makerInitial('Thinking Machines')).toBe('T')
    expect(makerInitial('  ')).toBe('?')
  })
})

describe('monthAlternates', () => {
  it('points the latest month at /bench, which shows the same board', () => {
    expect(monthAlternates('2026-12', '2026-12')).toEqual({ canonical: '/bench' })
  })
  it('leaves older months as their own page', () => {
    expect(monthAlternates('2026-11', '2026-12')).toBeUndefined()
    expect(monthAlternates('2026-11', null)).toBeUndefined()
  })
})
