import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { MAX_DIFF_RATIO, compare } from '../src/match'

const image = (w: number, h: number, pixels: Record<number, number[]> = {}): Buffer => {
  const png = new PNG({ width: w, height: h })
  for (let i = 0; i < w * h; i++) png.data.set(pixels[i] ?? [100, 100, 100, 255], i * 4)
  return PNG.sync.write(png)
}

describe('compare', () => {
  it('gives ratio 0 for identical images', () => {
    expect(compare(image(100, 100), image(100, 100)).ratio).toBe(0)
  })

  it('counts a pixel off by 9 on one channel', () => {
    const { ratio } = compare(image(100, 100), image(100, 100, { 5: [109, 100, 100, 255] }))
    expect(ratio).toBe(0.0001)
  })

  it('ignores a pixel off by 8', () => {
    expect(compare(image(100, 100), image(100, 100, { 5: [100, 108, 100, 255] })).ratio).toBe(0)
  })

  it('counts an alpha difference over 8', () => {
    expect(compare(image(10, 10), image(10, 10, { 0: [100, 100, 100, 240] })).ratio).toBe(0.01)
  })

  it('counts different sizes as fully different', () => {
    const result = compare(image(10, 10), image(10, 12))
    expect(result.ratio).toBe(1)
    expect(PNG.sync.read(result.diff).height).toBe(12)
  })

  it('marks the differing pixel in the diff image', () => {
    const { diff } = compare(image(4, 1), image(4, 1, { 2: [200, 100, 100, 255] }))
    const out = PNG.sync.read(diff)
    expect([...out.data.subarray(8, 12)]).toEqual([255, 0, 0, 255])
  })

  it('exports the pass threshold', () => {
    expect(MAX_DIFF_RATIO).toBe(0.001)
  })
})
