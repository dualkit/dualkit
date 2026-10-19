import { describe, expect, it } from 'vitest'
import { clickVia } from '../lib/v3/menu'
import { kitInitial, kitKeyEvent, kitReducer, type KitEvent } from '../lib/v3/kit-accordion'

const N = 5
const run = (events: KitEvent[]) => events.reduce((s, e) => kitReducer(s, e, N), kitInitial())

describe('kitReducer', () => {
  it('records a keyboard open, so the panel shows at once, and a pointer open after it', () => {
    expect(run([{ type: 'open', index: 2, via: 'keyboard' }]).via).toBe('keyboard')
    expect(run([{ type: 'open', index: 2, via: 'keyboard' }, { type: 'open', index: 1, via: 'pointer' }]).via).toBe('pointer')
  })
  it('starts with Skills open and focused', () => {
    expect(kitInitial()).toEqual({ open: 0, focus: 0, via: 'pointer' })
  })
  it('opens one item at a time and keeps it open when clicked again', () => {
    expect(run([{ type: 'open', index: 3 }])).toEqual({ open: 3, focus: 3, via: 'pointer' })
    expect(run([{ type: 'open', index: 3 }, { type: 'open', index: 3 }]).open).toBe(3)
  })
  it('ignores indexes outside the list', () => {
    expect(run([{ type: 'open', index: 5 }, { type: 'open', index: -1 }, { type: 'open', index: 1.5 }])).toEqual(kitInitial())
  })
  it('arrow keys move focus and wrap, without opening', () => {
    expect(run([{ type: 'move', dir: -1 }])).toEqual({ open: 0, focus: 4, via: 'pointer' })
    expect(run([{ type: 'move', dir: 1 }, { type: 'move', dir: 1 }])).toEqual({ open: 0, focus: 2, via: 'pointer' })
    expect(run(Array.from({ length: 5 }, () => ({ type: 'move', dir: 1 }) as KitEvent)).focus).toBe(0)
  })
  it('Home and End jump to the ends', () => {
    expect(run([{ type: 'edge', to: 'last' }]).focus).toBe(4)
    expect(run([{ type: 'edge', to: 'last' }, { type: 'edge', to: 'first' }]).focus).toBe(0)
  })
  it('follows native focus and returns the same state when nothing changes', () => {
    const s = kitInitial()
    expect(kitReducer(s, { type: 'focus', index: 0 }, N)).toBe(s)
    expect(kitReducer(s, { type: 'focus', index: 9 }, N)).toBe(s)
    expect(kitReducer(s, { type: 'focus', index: 2 }, N)).toEqual({ open: 0, focus: 2, via: 'pointer' })
  })
  it('does not mutate the previous state', () => {
    const s = kitInitial()
    kitReducer(s, { type: 'open', index: 2 }, N)
    expect(s).toEqual({ open: 0, focus: 0, via: 'pointer' })
  })
})

describe('kitKeyEvent', () => {
  it('maps the four navigation keys and nothing else', () => {
    expect(kitKeyEvent('ArrowDown')).toEqual({ type: 'move', dir: 1 })
    expect(kitKeyEvent('ArrowUp')).toEqual({ type: 'move', dir: -1 })
    expect(kitKeyEvent('Home')).toEqual({ type: 'edge', to: 'first' })
    expect(kitKeyEvent('End')).toEqual({ type: 'edge', to: 'last' })
    expect(kitKeyEvent('Enter')).toBeNull()
    expect(kitKeyEvent('a')).toBeNull()
  })
})

describe('clickVia', () => {
  it('reads a click with detail 0 (Enter or Space) as the keyboard and any other as the pointer', () => {
    expect(clickVia(0)).toBe('keyboard')
    expect(clickVia(1)).toBe('pointer')
    expect(clickVia(2)).toBe('pointer')
  })
})
