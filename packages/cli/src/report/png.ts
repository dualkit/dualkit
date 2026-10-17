// A small PNG reader: 8-bit, non-interlaced, every filter type. Enough for Chromium screenshots.
import { inflateSync } from 'node:zlib'

export type PngRows = { width: number; height: number; channels: number; rows: (visit: (row: Uint8Array, y: number) => void) => void }

const SIGNATURE = '89504e470d0a1a0a'
const CHANNELS: Partial<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function unfilterRow(raw: Buffer, at: number, row: Uint8Array, prev: Uint8Array, bpp: number): void {
  const type = raw[at]!
  for (let i = 0; i < row.length; i++) {
    const a = i >= bpp ? row[i - bpp]! : 0
    const b = prev[i]!
    const c = i >= bpp ? prev[i - bpp]! : 0
    const pred = type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : type === 4 ? paeth(a, b, c) : 0
    row[i] = (raw[at + 1 + i]! + pred) & 255
  }
}

/** The PNG's size and a row visitor that unfilters one row at a time; null for anything it cannot read. */
export function readPng(base64: string): PngRows | null {
  const buf = Buffer.from(base64, 'base64')
  if (buf.length < 33 || buf.subarray(0, 8).toString('hex') !== SIGNATURE) return null
  let width = 0
  let height = 0
  let channels = 0
  const idat: Buffer[] = []
  for (let at = 8; at + 8 <= buf.length;) {
    const len = buf.readUInt32BE(at)
    const type = buf.toString('ascii', at + 4, at + 8)
    const data = buf.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const c = CHANNELS[data[9]!]
      if (data[8] !== 8 || data[12] !== 0 || !c) return null
      channels = c
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    at += 12 + len
  }
  if (!width || !height || !channels || idat.length === 0) return null
  let raw: Buffer
  try {
    raw = inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }
  const stride = width * channels
  if (raw.length < (stride + 1) * height) return null
  return {
    width, height, channels,
    rows: (visit) => {
      let prev = new Uint8Array(stride)
      let row = new Uint8Array(stride)
      for (let y = 0; y < height; y++) {
        unfilterRow(raw, y * (stride + 1), row, prev, channels)
        visit(row, y)
        ;[prev, row] = [row, prev]
      }
    },
  }
}
