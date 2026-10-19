import { describe, expect, it } from 'vitest'
import type { BenchCell, BenchFinding, BenchModel, BenchMonth } from '../lib/bench-schema'
import { MAKER_MARKS } from '../lib/marks'
import { factsLine, factsOf, makerInitial, monthLabel, movementOf, pinSide, rawUrl, shotMarks, sideLine, tickFill, trackOf, unrankedReason } from '../lib/bench-view'

const total = (rulesPassed: number) => ({ rulesPassed, outOf: 100, score: rulesPassed })
type Ran = Extract<BenchCell, { ran: true }>
const ranCell = (over: Partial<Ran> = {}): Ran => ({ ran: true, runs: 3, rulesPassed: 14, score: 30, missing: [], findings: [], shot: null, pageHeight: 844, raw: 'bench/runs/2026-11/a/b/alone-2.json', ...over })
const model = (over: Partial<BenchModel> = {}): BenchModel => ({
  id: 'm', label: 'M', provider: 'gemini', by: 'Google', mark: 'google', rank: 2, previousRank: 3, isNew: false,
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
  it('is new without a previous rank', () => {
    expect(movementOf(model({ previousRank: null }))).toEqual({ kind: 'new' })
  })
  it('goes up, down or stays level', () => {
    expect(movementOf(model({ rank: 2, previousRank: 3 }))).toEqual({ kind: 'up', n: 1 })
    expect(movementOf(model({ rank: 3, previousRank: 1 }))).toEqual({ kind: 'down', n: 2 })
    expect(movementOf(model({ rank: 2, previousRank: 2 }))).toEqual({ kind: 'level' })
  })
  it('is level for an unranked model', () => {
    expect(movementOf(model({ rank: null, previousRank: 1 }))).toEqual({ kind: 'level' })
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

describe('pinSide', () => {
  it('puts pins past the inline end when there is room', () => {
    expect(pinSide(b(24, 0, 151), 2)).toBe('end')
  })
  it('puts them before the ring when it runs to the edge', () => {
    expect(pinSide(b(300, 0, 80), 1)).toBe('start')
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
    expect(Object.keys(MAKER_MARKS).sort()).toEqual(['cohere', 'google', 'nvidia', 'poolside', 'thinking-machines'])
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
