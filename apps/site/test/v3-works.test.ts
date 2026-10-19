import { describe, expect, it } from 'vitest'
import { TILE_STEP_MS, tileDelay, tileDelays } from '../lib/v3/tile-wave'

describe('tileDelay', () => {
  it('steps 175 ms per diagonal', () => {
    expect(TILE_STEP_MS).toBe(175)
    expect(tileDelay(0, 6)).toBe(0)
    expect(tileDelay(5, 6)).toBe(5 * 175)
  })
  it('adds column and row on a two column grid', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => tileDelay(i, 2))).toEqual([0, 175, 175, 350, 350, 525])
  })
  it('is monotonic along one row', () => {
    const row = tileDelays(6, 6)
    for (let i = 1; i < row.length; i++) expect(row[i]).toBeGreaterThan(row[i - 1]!)
  })
  it('rejects bad input', () => {
    expect(() => tileDelay(0, 0)).toThrow()
    expect(() => tileDelay(-1, 2)).toThrow()
    expect(() => tileDelay(1.5, 2)).toThrow()
  })
})
