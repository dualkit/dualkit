import { describe, expect, it } from 'vitest'
import { flip, shown, type FlipState } from '../lib/tile-flip'

const rest: FlipState = { peek: false, pinned: false }

describe('tile flip', () => {
  it('shows the base language at rest', () => {
    expect(shown('en', rest)).toBe('en')
    expect(shown('ar', rest)).toBe('ar')
  })

  it('peeks the other language while a fine pointer hovers, and returns on leave', () => {
    const over = flip(rest, { type: 'enter', pointer: 'mouse' })
    expect(shown('en', over)).toBe('ar')
    expect(shown('en', flip(over, { type: 'leave', pointer: 'mouse' }))).toBe('en')
  })

  it('ignores touch enter and leave, so a tap is not undone by the emulated hover', () => {
    expect(flip(rest, { type: 'enter', pointer: 'touch' })).toEqual(rest)
    const pinned = flip(rest, { type: 'activate', pointer: 'touch' })
    expect(flip(pinned, { type: 'leave', pointer: 'touch' })).toEqual(pinned)
  })

  it('a tap toggles and stays', () => {
    const once = flip(rest, { type: 'activate', pointer: 'touch' })
    expect(shown('ar', once)).toBe('en')
    expect(shown('ar', flip(once, { type: 'activate', pointer: 'touch' }))).toBe('ar')
  })

  it('a click while hovering keeps the hovered language instead of snapping back', () => {
    const over = flip(rest, { type: 'enter', pointer: 'mouse' })
    const clicked = flip(over, { type: 'activate', pointer: 'mouse' })
    expect(shown('en', clicked)).toBe('ar')
    expect(shown('en', flip(clicked, { type: 'leave', pointer: 'mouse' }))).toBe('ar')
  })

  it('keyboard focus peeks and blur returns', () => {
    const focused = flip(rest, { type: 'focus' })
    expect(shown('en', focused)).toBe('ar')
    expect(shown('en', flip(focused, { type: 'blur' }))).toBe('en')
  })

  it('Enter while focused pins the language that is showing', () => {
    const pinned = flip(flip(rest, { type: 'focus' }), { type: 'activate', pointer: 'keyboard' })
    expect(shown('en', flip(pinned, { type: 'blur' }))).toBe('ar')
  })
})
