import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { paintMap } from '../src/report/paint'

type RGB = [number, number, number]
const GREY: RGB = [244, 244, 245]
const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [9, 9, 11]

/** An RGB PNG drawn by a function of device pixel, every row using a different filter type. */
function png(w: number, h: number, at: (x: number, y: number) => RGB): string {
  const rows: number[] = []
  let prevRow: number[] = new Array(w * 3).fill(0)
  for (let y = 0; y < h; y++) {
    const filter = y % 5
    const row = Array.from({ length: w }, (_, x) => at(x, y)).flat()
    rows.push(filter)
    row.forEach((v, i) => {
      const a = i >= 3 ? row[i - 3]! : 0
      const b = prevRow[i]!
      const c = i >= 3 ? prevRow[i - 3]! : 0
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      const pred = [0, a, b, (a + b) >> 1, paeth][filter]!
      rows.push((v - pred + 256) & 255)
    })
    prevRow = row
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0))]).toString('base64')
}

/** CSS 100x60 at 2x: grey page, a white card from x 20 to 80, a black button inside it from y 30 to 40. */
const scene = (x: number, y: number): RGB => {
  const [cx, cy] = [x / 2, y / 2]
  if (cx >= 30 && cx < 70 && cy >= 30 && cy < 40) return BLACK
  return cx >= 20 && cx < 80 ? WHITE : GREY
}

describe('paintMap', () => {
  const map = paintMap(png(200, 120, scene), 100, 60)!

  it('reads a 2x capture against CSS pixel boxes', () => {
    expect(map).not.toBeNull()
    expect(map.isClear({ x: 22, y: 4, width: 10, height: 10 })).toBe(true)
    expect(map.isClear({ x: 2, y: 4, width: 10, height: 10 })).toBe(true)
  })

  it('treats a filled area as painted, not only its edges', () => {
    expect(map.isClear({ x: 40, y: 32, width: 6, height: 6 })).toBe(false)
    expect(map.isClear({ x: 40, y: 44, width: 6, height: 6 })).toBe(true)
  })

  it('finds the content span: what differs from the page background', () => {
    expect(map.contentSpan(0, 60)).toEqual({ x0: 20, x1: 80 })
  })

  it('refuses a PNG whose size does not match the page', () => {
    expect(paintMap(png(150, 90, scene), 100, 60)).toBeNull()
    expect(paintMap('iVBORw0KGgo=', 100, 60)).toBeNull()
    expect(paintMap('not base64 at all', 100, 60)).toBeNull()
  })

  it('reads a 1x capture too', () => {
    const one = paintMap(png(100, 60, (x, y) => scene(x * 2, y * 2)), 100, 60)!
    expect(one.isClear({ x: 40, y: 32, width: 6, height: 6 })).toBe(false)
    expect(one.contentSpan(0, 60)).toEqual({ x0: 20, x1: 80 })
  })
})
