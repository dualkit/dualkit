import { describe, expect, it } from 'vitest'
import { V3 } from '../lib/v3/copy'
import { checkFamilies, parsedFormatLines } from '../lib/v3/kit-data'
import { MENU_CLOSED, benchCountdown, daysUntil, menuReducer, nextBenchRun, type MenuState } from '../lib/v3/menu'

const open = (active = 0, via: MenuState['via'] = 'pointer'): MenuState => ({ open: true, active, via })

describe('menuReducer', () => {
  it('wraps a move down from the last part to the first', () => {
    expect(menuReducer(open(4), { type: 'move', dir: 1 }).active).toBe(0)
  })
  it('wraps a move up from the first part to the last', () => {
    expect(menuReducer(open(0), { type: 'move', dir: -1 }).active).toBe(4)
  })
  it('moves one step without wrapping in the middle', () => {
    expect(menuReducer(open(2), { type: 'move', dir: 1 }).active).toBe(3)
  })
  it('sets active on hover', () => {
    expect(menuReducer(open(0), { type: 'hover', index: 3 }).active).toBe(3)
  })
  it('ignores a hover outside the list', () => {
    const s = open(2)
    expect(menuReducer(s, { type: 'hover', index: 9 })).toBe(s)
    expect(menuReducer(s, { type: 'hover', index: -1 })).toBe(s)
  })
  it('records a keyboard toggle', () => {
    expect(menuReducer(MENU_CLOSED, { type: 'toggle', via: 'keyboard' })).toEqual({ open: true, active: 0, via: 'keyboard' })
  })
  it('records a pointer toggle', () => {
    expect(menuReducer(MENU_CLOSED, { type: 'toggle', via: 'pointer' }).via).toBe('pointer')
  })
  it('closes on a second toggle and resets active', () => {
    const s = menuReducer(open(3), { type: 'toggle', via: 'pointer' })
    expect(s.open).toBe(false)
    expect(s.active).toBe(0)
  })
  it('resets active to 0 on close', () => {
    const s = menuReducer(open(3, 'keyboard'), { type: 'close' })
    expect(s.open).toBe(false)
    expect(s.active).toBe(0)
  })
  it('keeps how it was opened through the close, so a keyboard menu also closes without animation', () => {
    expect(menuReducer(open(1, 'keyboard'), { type: 'close' }).via).toBe('keyboard')
  })
  it('does not mutate the state it was given', () => {
    const s = Object.freeze(open(1))
    menuReducer(s, { type: 'move', dir: 1 })
    expect(s.active).toBe(1)
  })
})

describe('nextBenchRun', () => {
  it('is 04:17 UTC on the 1st of next month', () => {
    expect(nextBenchRun(new Date('2026-10-19T12:00:00Z')).toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
  it('moves on a month once the run on the 1st has started', () => {
    expect(nextBenchRun(new Date('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-12-01T04:17:00.000Z')
  })
  it('crosses the year', () => {
    expect(nextBenchRun(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe('2027-01-01T04:17:00.000Z')
  })
  it('is still today before 04:17 on the 1st', () => {
    expect(nextBenchRun(new Date('2026-11-01T03:00:00Z')).toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
})

describe('bench countdown', () => {
  it('counts whole days left', () => {
    const now = new Date('2026-10-19T12:00:00Z')
    expect(daysUntil(nextBenchRun(now), now)).toBe(12)
  })
  it('never says 0 days', () => {
    expect(daysUntil(new Date('2026-11-01T04:17:00Z'), new Date('2026-10-31T20:00:00Z'))).toBe(1)
  })
  it('says days, or day for one', () => {
    expect(benchCountdown(12)).toBe(V3.menu.bench[1])
    expect(benchCountdown(1)).toBe('Next run in 1 day')
  })
})

describe('kit data', () => {
  it('parses the Format lines with @dualkit/format to the approved results', () => {
    expect(parsedFormatLines().map((l) => l.out)).toEqual(V3.kit.previews.format.lines.map((l) => l.out))
  })
  it('counts the Check families from the rules package', () => {
    expect(checkFamilies()).toEqual(V3.kit.previews.check.families.map(([name, n]) => [name, n]))
  })
})
