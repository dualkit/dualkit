import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { VIEWPORT_HEIGHT, tiles } from '../../src/review/tiles'

const png = (viewports: number, scale = 1): string => {
  const p = new PNG({ width: 4, height: Math.round(VIEWPORT_HEIGHT * viewports * scale) })
  p.data.fill(255)
  return PNG.sync.write(p).toString('base64')
}
const heightOf = (b64: string) => PNG.sync.read(Buffer.from(b64, 'base64')).height

describe('tiles', () => {
  it('cuts one slice per viewport', () => {
    expect(tiles(png(3), 1)).toHaveLength(3)
  })
  it('keeps the first four slices of a tall page', () => {
    expect(tiles(png(9), 1)).toHaveLength(4)
    expect(tiles(png(9), 1, 2)).toHaveLength(2)
  })
  it('scales the slice height and keeps a short last slice', () => {
    const out = tiles(png(1.5, 2), 2)
    expect(out.map(heightOf)).toEqual([VIEWPORT_HEIGHT * 2, VIEWPORT_HEIGHT])
  })
  it('returns the page whole when it is shorter than a viewport', () => {
    expect(tiles(png(0.5), 1)).toHaveLength(1)
  })
})
