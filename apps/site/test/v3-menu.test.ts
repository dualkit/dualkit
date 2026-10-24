import { describe, expect, it } from 'vitest'
import { V3 } from '../lib/v3/copy'
import { checkFamilies, parsedFormatLines } from '../lib/v3/kit-data'
import { LEAVE_MS, MENU_CLOSED, PART_COUNT, benchCountdown, daysUntil, insideAny, menuReducer, nextBenchRun, type MenuState } from '../lib/v3/menu'

const open = (active = 0, via: MenuState['via'] = 'pointer', away = false, step: MenuState['step'] = 'pointer'): MenuState => ({ open: true, active, via, step, away })

describe('menuReducer', () => {
  it('has a part for each product, Convert included', () => {
    expect(PART_COUNT).toBe(6)
  })
  it('wraps a move down from the last part to the first', () => {
    expect(menuReducer(open(PART_COUNT - 1), { type: 'move', dir: 1 }).active).toBe(0)
  })
  it('wraps a move up from the first part to the last', () => {
    expect(menuReducer(open(0), { type: 'move', dir: -1 }).active).toBe(PART_COUNT - 1)
  })
  it('moves one step without wrapping in the middle', () => {
    expect(menuReducer(open(2), { type: 'move', dir: 1 }).active).toBe(3)
  })
  it('sets active on hover', () => {
    expect(menuReducer(open(0), { type: 'hover', index: 3, via: 'pointer' }).active).toBe(3)
  })
  it('ignores a hover outside the list', () => {
    const s = open(2)
    expect(menuReducer(s, { type: 'hover', index: 9, via: 'pointer' })).toBe(s)
    expect(menuReducer(s, { type: 'hover', index: -1, via: 'pointer' })).toBe(s)
  })
  it('records a keyboard toggle', () => {
    expect(menuReducer(MENU_CLOSED, { type: 'toggle', via: 'keyboard' })).toEqual({ open: true, active: 0, via: 'keyboard', step: 'keyboard', away: false })
  })
  it('marks an arrow move as a keyboard step, so the preview switches at once', () => {
    expect(menuReducer(open(0), { type: 'move', dir: 1 }).step).toBe('keyboard')
  })
  it('marks a Tab focus as a keyboard step and a pointer entering a row as a pointer step', () => {
    expect(menuReducer(open(0), { type: 'hover', index: 2, via: 'keyboard' }).step).toBe('keyboard')
    expect(menuReducer(open(0, 'pointer', false, 'keyboard'), { type: 'hover', index: 2, via: 'pointer' }).step).toBe('pointer')
  })
  it('keeps how the menu was opened when a step changes, so leaving still closes a pointer menu', () => {
    const s = menuReducer(open(0, 'pointer'), { type: 'move', dir: 1 })
    expect(s.via).toBe('pointer')
    expect(menuReducer(s, { type: 'away' }).away).toBe(true)
  })
  it('leaves the state alone when focus lands on the row that is already active', () => {
    const s = open(1)
    expect(menuReducer(s, { type: 'hover', index: 1, via: 'keyboard' })).toBe(s)
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

describe('menu close intent', () => {
  it('marks a pointer-opened menu as left when the mouse goes away', () => {
    expect(menuReducer(open(2), { type: 'away' })).toEqual(open(2, 'pointer', true))
  })
  it('ignores the mouse for a menu opened from the keyboard, and for a closed menu', () => {
    expect(menuReducer(open(0, 'keyboard'), { type: 'away' })).toEqual(open(0, 'keyboard'))
    expect(menuReducer(MENU_CLOSED, { type: 'away' })).toBe(MENU_CLOSED)
  })
  it('cancels the intent when the pointer comes back', () => {
    expect(menuReducer(open(1, 'pointer', true), { type: 'back' })).toEqual(open(1))
    const s = open(1)
    expect(menuReducer(s, { type: 'back' })).toBe(s)
  })
  it('closes once the leave delay runs out, only if the pointer is still away', () => {
    expect(menuReducer(open(1, 'pointer', true), { type: 'away-elapsed' })).toEqual({ ...MENU_CLOSED, via: 'pointer' })
    const s = open(1)
    expect(menuReducer(s, { type: 'away-elapsed' })).toBe(s)
  })
  it('clears the intent on toggle and close', () => {
    expect(menuReducer(open(0, 'pointer', true), { type: 'close' }).away).toBe(false)
    expect(menuReducer(open(0, 'pointer', true), { type: 'toggle', via: 'pointer' }).away).toBe(false)
  })
  it('waits about 300ms', () => {
    expect(LEAVE_MS).toBe(300)
  })
  it('tests a point against the nav and drawer boxes, edges included', () => {
    const boxes = [{ left: 0, top: 0, right: 100, bottom: 70 }, { left: 20, top: 70, right: 80, bottom: 300 }]
    expect(insideAny(50, 10, boxes)).toBe(true)
    expect(insideAny(80, 300, boxes)).toBe(true)
    expect(insideAny(10, 200, boxes)).toBe(false)
    expect(insideAny(50, 301, boxes)).toBe(false)
    expect(insideAny(50, 10, [])).toBe(false)
  })
})
