import { describe, expect, it } from 'vitest'
import { boundarySplit, sideVerdict, touchesTatweel, type Forms } from '../src/dom/joins'

// The decision is pure: widths in, verdict out. These run without a browser, so they cover the branches on every platform.
const forms = (zwj: Forms, neighbour: Forms = zwj) => (kind: 'zwj' | 'neighbour'): Forms => (kind === 'zwj' ? zwj : neighbour)

describe('sideVerdict', () => {
  it('reports when the rendered width is nearest the non-joining form', () => {
    expect(sideVerdict(8.4, forms([9.8, 8.4]))).toBe(true)
  })
  it('stays quiet when the rendered width is nearest the joining form', () => {
    expect(sideVerdict(9.7, forms([9.8, 8.4]))).toBe(false)
  })
  it('cannot tell when both forms are within half a pixel', () => {
    expect(sideVerdict(5, forms([5.2, 5.0], [5.4, 5.0]))).toBeNull()
    expect(sideVerdict(5, forms([5.5, 5.0]))).toBeNull()
  })
  it('falls back to the neighbour letter when the ZWJ forms are equal', () => {
    const asked: string[] = []
    const f = (kind: 'zwj' | 'neighbour'): Forms => { asked.push(kind); return kind === 'zwj' ? [5.05, 5.05] : [6.73, 5.05] }
    expect(sideVerdict(5.05, f)).toBe(true)
    expect(asked).toEqual(['zwj', 'neighbour'])
    expect(sideVerdict(6.7, (k) => (k === 'zwj' ? [5.05, 5.05] : [6.73, 5.05]))).toBe(false)
  })
  it('does not ask for the neighbour forms when the ZWJ forms already differ', () => {
    const asked: string[] = []
    sideVerdict(8, (k) => { asked.push(k); return [9, 8] })
    expect(asked).toEqual(['zwj'])
  })
})

describe('boundarySplit', () => {
  it('reports when either side is split, and not when neither is', () => {
    expect(boundarySplit(true, false)).toBe(true)
    expect(boundarySplit(null, true)).toBe(true)
    expect(boundarySplit(false, null)).toBe(false)
    expect(boundarySplit(null, null)).toBe(false)
  })
})

describe('touchesTatweel', () => {
  it('skips a boundary next to a tatweel, as in the Hijri abbreviation', () => {
    expect(touchesTatweel('1447 \u0647\u0640', 6, '\u0627\u0644\u062a\u0627\u0631\u064a\u062e')).toBe(true)
    expect(touchesTatweel('\u0645\u062d', 1, '\u0640\u0645')).toBe(true)
  })
  it('keeps a split inside a real word', () => {
    expect(touchesTatweel('\u0645\u062d', 1, '\u0645\u062f')).toBe(false)
  })
})
