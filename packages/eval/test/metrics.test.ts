import { describe, expect, it } from 'vitest'
import { f1, precision, recall } from '../src/metrics.js'

describe('metrics', () => {
  it('precision counts real findings over all labelled findings', () => {
    expect(precision({ real: 8, handled: 1, intended: 1, unclear: 5 })).toBe(0.8)
    expect(precision({ real: 0, handled: 0, intended: 0, unclear: 3 })).toBeNull()
  })
  it('recall is caught over total', () => {
    expect(recall(54, 60)).toBe(0.9)
    expect(recall(0, 0)).toBeNull()
  })
  it('f1 is the harmonic mean, null when an input is null', () => {
    expect(f1(0.8, 0.9)).toBeCloseTo(0.8471, 4)
    expect(f1(null, 0.9)).toBeNull()
    expect(f1(0, 0)).toBe(0)
  })
})
