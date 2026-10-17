import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { clearance, decodeLuma } from '../src/report/png'

/** A tiny RGB PNG: white with one black pixel at (x, y), using filter type 1 on every row. */
function png(w: number, h: number, dot: { x: number; y: number }): string {
  const rows: number[] = []
  for (let y = 0; y < h; y++) {
    rows.push(1)
    let prev = [0, 0, 0]
    for (let x = 0; x < w; x++) {
      const v = x === dot.x && y === dot.y ? 0 : 255
      const px = [v, v, v]
      rows.push(...px.map((c, i) => (c - prev[i]! + 256) & 255))
      prev = px
    }
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

describe('decodeLuma', () => {
  it('reads a filtered RGB PNG into one luma byte per pixel', () => {
    const img = decodeLuma(png(8, 6, { x: 5, y: 3 }))
    expect(img).not.toBeNull()
    expect(img!.width).toBe(8)
    expect(img!.height).toBe(6)
    expect(img!.luma[3 * 8 + 5]).toBe(0)
    expect(img!.luma[0]).toBe(255)
  })

  it('returns null for anything that is not a PNG it can read', () => {
    expect(decodeLuma('iVBORw0KGgo=')).toBeNull()
    expect(decodeLuma('not base64 at all')).toBeNull()
  })
})

describe('clearance', () => {
  it('says a rectangle is clear only when nothing is painted inside it', () => {
    const isClear = clearance(decodeLuma(png(40, 40, { x: 20, y: 20 }))!)
    expect(isClear({ x: 0, y: 0, width: 10, height: 10 })).toBe(true)
    expect(isClear({ x: 15, y: 15, width: 10, height: 10 })).toBe(false)
    expect(isClear({ x: 35, y: 35, width: 10, height: 10 })).toBe(false)
  })
})
