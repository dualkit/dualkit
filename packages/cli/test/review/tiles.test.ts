import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { tiles } from '../../src/review/tiles'

const VH = 800
const png = (viewports: number, scale = 1, vh = VH): string => {
  const p = new PNG({ width: 4, height: Math.round(vh * viewports * scale) })
  p.data.fill(255)
  return PNG.sync.write(p).toString('base64')
}
const heightOf = (b64: string) => PNG.sync.read(Buffer.from(b64, 'base64')).height

describe('tiles', () => {
  it('cuts one slice per viewport', () => {
    expect(tiles(png(3), 1, VH)).toHaveLength(3)
  })
  it('keeps the first four slices of a tall page', () => {
    expect(tiles(png(9), 1, VH)).toHaveLength(4)
    expect(tiles(png(9), 1, VH, 2)).toHaveLength(2)
  })
  it('scales the slice height and keeps a short last slice', () => {
    const out = tiles(png(1.5, 2), 2, VH)
    expect(out.map(heightOf)).toEqual([VH * 2, VH])
  })
  it('slices by the viewport height it is given', () => {
    expect(tiles(png(3, 1, 844), 1, 844).map(heightOf)).toEqual([844, 844, 844])
    expect(tiles(png(2, 2, 844), 2, 844).map(heightOf)).toEqual([1688, 1688])
  })
  it('returns the page whole when it is shorter than a viewport', () => {
    expect(tiles(png(0.5), 1, VH)).toHaveLength(1)
  })
})
