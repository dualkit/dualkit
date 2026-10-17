// Where the page has painted something, measured from the screenshot in CSS pixels at any capture scale.
import type { Box } from './geometry'
import { readPng } from './png'

export type PaintMap = {
  /** True when nothing is painted in the rectangle or within a small margin of it. */
  isClear: (r: Box) => boolean
  /** Left and right edges of everything that differs from the page background between two rows. */
  contentSpan: (y0: number, y1: number) => { x0: number; x1: number } | null
}

/** A brightness step this large between neighbours is an edge: text or an icon, not a hairline border. */
const EDGE = 32
/** A colour covering this share of the screen is a background (the page, a card), not content. */
const BACKGROUND_SHARE = 0.1
/** Colours this close (in 8-level steps per channel) to a background still count as background. */
const NEAR_BACKGROUND = 3
const MARGIN = 2

const key = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
const near = (a: number, b: number, d: number) =>
  Math.abs((a >> 10) - (b >> 10)) <= d && Math.abs(((a >> 5) & 31) - ((b >> 5) & 31)) <= d && Math.abs((a & 31) - (b & 31)) <= d
const mostCommon = (counts: Map<number, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0

type Sample = { keys: Uint16Array; edges: Uint8Array }

/** One colour key per CSS pixel (its top-left device pixel) and whether any device pixel in it is an edge. */
function sample(base64: string, cssW: number, cssH: number): Sample | null {
  const png = readPng(base64)
  if (!png) return null
  const scale = png.width / cssW
  if (!Number.isInteger(scale) || scale < 1 || png.height !== cssH * scale) return null
  const keys = new Uint16Array(cssW * cssH)
  const edges = new Uint8Array(cssW * cssH)
  const c = png.channels
  let prevLuma = new Uint8Array(png.width)
  let luma = new Uint8Array(png.width)
  png.rows((row, y) => {
    const cy = Math.floor(y / scale)
    for (let x = 0; x < png.width; x++) {
      const p = x * c
      const [r, g, b] = c < 3 ? [row[p]!, row[p]!, row[p]!] : [row[p]!, row[p + 1]!, row[p + 2]!]
      const l = (r * 54 + g * 183 + b * 19) >> 8
      luma[x] = l
      const at = cy * cssW + Math.floor(x / scale)
      if (y % scale === 0 && x % scale === 0) keys[at] = key(r, g, b)
      if ((x > 0 && Math.abs(l - luma[x - 1]!) > EDGE) || (y > 0 && Math.abs(l - prevLuma[x]!) > EDGE)) edges[at] = 1
    }
    ;[prevLuma, luma] = [luma, prevLuma]
  })
  return { keys, edges }
}

export function paintMap(base64: string, cssW: number, cssH: number): PaintMap | null {
  const s = sample(base64, cssW, cssH)
  if (!s) return null
  const { keys, edges } = s
  const counts = new Map<number, number>()
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
  const backgrounds = [...counts.entries()].filter(([, n]) => n >= keys.length * BACKGROUND_SHARE).map(([k]) => k)
  const sideCounts = new Map<number, number>()
  for (let y = 0; y < cssH; y++) for (const x of [0, cssW - 1]) sideCounts.set(keys[y * cssW + x]!, (sideCounts.get(keys[y * cssW + x]!) ?? 0) + 1)
  const page = mostCommon(sideCounts)

  const sum = new Int32Array((cssW + 1) * (cssH + 1))
  const spanMin = new Int32Array(cssH).fill(-1)
  const spanMax = new Int32Array(cssH).fill(-1)
  const isBackground = new Map<number, boolean>()
  for (let y = 0; y < cssH; y++) {
    let run = 0
    for (let x = 0; x < cssW; x++) {
      const k = keys[y * cssW + x]!
      let bg = isBackground.get(k)
      if (bg === undefined) {
        bg = backgrounds.some((b) => near(k, b, NEAR_BACKGROUND))
        isBackground.set(k, bg)
      }
      run += edges[y * cssW + x] || !bg ? 1 : 0
      sum[(y + 1) * (cssW + 1) + x + 1] = sum[y * (cssW + 1) + x + 1]! + run
      if (k !== page) {
        if (spanMin[y] === -1) spanMin[y] = x
        spanMax[y] = x + 1
      }
    }
  }
  const at = (x: number, y: number) => sum[y * (cssW + 1) + x]!
  return {
    isClear: (r) => {
      if (r.x < 0 || r.y < 0 || r.x + r.width > cssW || r.y + r.height > cssH) return false
      const x0 = Math.max(0, Math.floor(r.x - MARGIN))
      const y0 = Math.max(0, Math.floor(r.y - MARGIN))
      const x1 = Math.min(cssW, Math.ceil(r.x + r.width + MARGIN))
      const y1 = Math.min(cssH, Math.ceil(r.y + r.height + MARGIN))
      return at(x1, y1) - at(x0, y1) - at(x1, y0) + at(x0, y0) === 0
    },
    contentSpan: (y0, y1) => {
      let lo = Infinity
      let hi = -Infinity
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(cssH, Math.ceil(y1)); y++) {
        if (spanMin[y]! < 0) continue
        lo = Math.min(lo, spanMin[y]!)
        hi = Math.max(hi, spanMax[y]!)
      }
      return lo < hi ? { x0: lo, x1: hi } : null
    },
  }
}
