import { describe, expect, it } from 'vitest'
import { OverlapError, applyEdits } from '../src/edits'

describe('applyEdits', () => {
  it('applies non-overlapping edits given out of order', () => {
    const out = applyEdits('abcdef', [
      { start: 4, end: 5, text: 'X' },
      { start: 0, end: 1, text: 'Y' },
      { start: 2, end: 3, text: 'ZZ' },
    ])
    expect(out).toBe('YbZZdXf')
  })

  it('keeps given order for inserts at the same offset', () => {
    expect(applyEdits('abcd', [{ start: 2, end: 2, text: '1' }, { start: 2, end: 2, text: '2' }])).toBe('ab12cd')
  })

  it('throws OverlapError naming both edits', () => {
    const a = { start: 1, end: 3, text: 'a' }
    const b = { start: 2, end: 4, text: 'b' }
    expect(() => applyEdits('abcdef', [b, a])).toThrow(OverlapError)
    expect(() => applyEdits('abcdef', [a, b])).toThrow('[1, 3) and [2, 4)')
  })

  it('returns the input when there are no edits', () => {
    expect(applyEdits('abc', [])).toBe('abc')
  })
})
