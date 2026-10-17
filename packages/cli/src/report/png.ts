// Reads the screenshot's pixels so pins can be placed where the page has painted nothing.
import { inflateSync } from 'node:zlib'
import type { Box } from './geometry'

export type Luma = { width: number; height: number; luma: Uint8Array }

const SIGNATURE = '89504e470d0a1a0a'
const CHANNELS: Partial<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 }
/** A step in brightness this large between neighbours is an edge: text or an icon. Hairline borders (#e4e4e7 on white) stay below it, so a pin may sit across one. */
const EDGE = 32
/** Pins keep this many pixels away from any edge. */
const MARGIN = 2

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function unfilter(raw: Buffer, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!
      const a = i >= bpp ? out[row + i - bpp]! : 0
      const b = y > 0 ? out[row - stride + i]! : 0
      const c = i >= bpp && y > 0 ? out[row - stride + i - bpp]! : 0
      const pred = type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : type === 4 ? paeth(a, b, c) : 0
      out[row + i] = (x + pred) & 255
    }
  }
  return out
}

/** One brightness byte per pixel for an 8-bit, non-interlaced PNG; null for anything else. */
export function decodeLuma(base64: string): Luma | null {
  try {
    const buf = Buffer.from(base64, 'base64')
    if (buf.length < 33 || buf.subarray(0, 8).toString('hex') !== SIGNATURE) return null
    let width = 0
    let height = 0
    let bpp = 0
    const idat: Buffer[] = []
    for (let at = 8; at + 8 <= buf.length;) {
      const len = buf.readUInt32BE(at)
      const type = buf.toString('ascii', at + 4, at + 8)
      const data = buf.subarray(at + 8, at + 8 + len)
      if (type === 'IHDR') {
        width = data.readUInt32BE(0)
        height = data.readUInt32BE(4)
        const channels = CHANNELS[data[9]!]
        if (data[8] !== 8 || data[12] !== 0 || !channels) return null
        bpp = channels
      } else if (type === 'IDAT') idat.push(data)
      else if (type === 'IEND') break
      at += 12 + len
    }
    if (!width || !height || !bpp || idat.length === 0) return null
    const px = unfilter(inflateSync(Buffer.concat(idat)), width, height, bpp)
    const luma = new Uint8Array(width * height)
    for (let i = 0; i < luma.length; i++) {
      const p = i * bpp
      luma[i] = bpp < 3 ? px[p]! : (px[p]! * 54 + px[p + 1]! * 183 + px[p + 2]! * 19) >> 8
    }
    return { width, height, luma }
  } catch {
    return null
  }
}

/** A test for "nothing painted here": no edge inside the rectangle or within a small margin of it. */
export function clearance(img: Luma): (r: Box) => boolean {
  const { width: w, height: h, luma } = img
  const sum = new Int32Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let run = 0
    for (let x = 0; x < w; x++) {
      const v = luma[y * w + x]!
      const edge = (x > 0 && Math.abs(v - luma[y * w + x - 1]!) > EDGE) || (y > 0 && Math.abs(v - luma[(y - 1) * w + x]!) > EDGE)
      run += edge ? 1 : 0
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1]! + run
    }
  }
  return (r) => {
    if (r.x < 0 || r.y < 0 || r.x + r.width > w || r.y + r.height > h) return false
    const x0 = Math.max(0, Math.floor(r.x - MARGIN))
    const y0 = Math.max(0, Math.floor(r.y - MARGIN))
    const x1 = Math.min(w, Math.ceil(r.x + r.width + MARGIN))
    const y1 = Math.min(h, Math.ceil(r.y + r.height + MARGIN))
    const at = (x: number, y: number) => sum[y * (w + 1) + x]!
    return at(x1, y1) - at(x0, y1) - at(x1, y0) + at(x0, y0) === 0
  }
}
