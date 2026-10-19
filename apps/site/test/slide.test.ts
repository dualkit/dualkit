import { describe, expect, it } from 'vitest'
import { fillClip, fillLength, slideTravel } from '../lib/slide'

const m = { max: 200, inset: 8, thumb: 48, radius: '0px' }

describe('slide geometry', () => {
  it('travels the inner width less the thumb, never below zero', () => {
    expect(slideTravel(280, 48, 8)).toBe(216)
    expect(slideTravel(40, 48, 8)).toBe(0)
  })
  it('fills from the start edge to the thumb centre', () => {
    expect(fillLength(0, m)).toBe(32)
    expect(fillLength(1, m)).toBe(232)
  })
  it('cuts the fill from the inline end, mirrored in Arabic', () => {
    expect(fillClip(32, false, '0px')).toBe('inset(0 calc(100% - 32.00px) 0 0 round 0px)')
    expect(fillClip(32, true, '999px')).toBe('inset(0 0 0 calc(100% - 32.00px) round 999px)')
  })
  it('never cuts past the full fill', () => {
    expect(fillClip(-5, false, '0px')).toBe('inset(0 calc(100% - 0.00px) 0 0 round 0px)')
  })
})
