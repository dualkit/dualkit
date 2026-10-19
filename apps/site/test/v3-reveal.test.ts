import { describe, expect, it } from 'vitest'
import { trackProgress, wordOpacity } from '../lib/v3/reveal'

describe('wordOpacity', () => {
  it('starts at 0.18 and ends at 1', () => {
    expect(wordOpacity(0, 0, 20)).toBe(0.18)
    expect(wordOpacity(0, 19, 20)).toBe(0.18)
    expect(wordOpacity(1, 19, 20)).toBe(1)
    expect(wordOpacity(1, 0, 20)).toBe(1)
  })
  it('is monotonic in progress for every word', () => {
    for (let i = 0; i < 20; i++) {
      let prev = -1
      for (let s = 0; s <= 200; s++) {
        const v = wordOpacity(s / 200, i, 20)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })
  it('word i reaches 1 before word i+1', () => {
    const at = (i: number) => {
      for (let s = 0; s <= 1000; s++) if (wordOpacity(s / 1000, i, 20) === 1) return s
      return Infinity
    }
    for (let i = 0; i < 19; i++) expect(at(i)).toBeLessThan(at(i + 1))
  })
  it('clamps progress and handles one word', () => {
    expect(wordOpacity(-1, 3, 20)).toBe(0.18)
    expect(wordOpacity(2, 3, 20)).toBe(1)
    expect(wordOpacity(1, 0, 1)).toBe(1)
  })
})

describe('trackProgress', () => {
  it('maps the sticky run to 0..1', () => {
    expect(trackProgress(100, 1500, 900)).toBe(0)
    expect(trackProgress(-300, 1500, 900)).toBe(0.5)
    expect(trackProgress(-900, 1500, 900)).toBe(1)
    expect(trackProgress(0, 900, 900)).toBe(1)
  })
})
