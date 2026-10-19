export type GridJson = { cols: number; rows: number; step: number; bits: string; cities: Record<string, [number, number]> }
export type Grid = { cols: number; rows: number; step: number; land(c: number, r: number): boolean; cities: Record<string, [number, number]> }
export type Cell = { x: number; y: number; lit: boolean; delay: number }
export type CityTiming = { name: string; x: number; y: number; pass: number; tag: number }

export const DESIGN_W = 1440
export const DESIGN_H = 900
/** Squares closer than this to a city (design px) are drawn at the higher opacity. */
export const NEAR_PX = 44
/** Ripple speed: 1.2 ms for every design px away from the origin. */
export const MS_PER_PX = 1.2
export const TAG_GAP_MS = 80
/** Pitch of the phone map's re-gridded dots (design/figma/gen/v3/mobile.mjs). */
export const PHONE_PITCH = 5
/** Share of the crop width left empty on each side of the cities, so a point sits at least 5% of the map width from the edge (16 px from 320 px up). */
export const PHONE_PAD = 0.05
export const ORIGIN_CITY = 'Dubai'

/** Unpacks the generator's bitset: row-major, most significant bit first, 1 = land. */
export function decodeGrid(json: GridJson): Grid {
  const raw = atob(json.bits)
  const { cols, rows } = json
  const bytes = Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
  return {
    cols,
    rows,
    step: json.step,
    cities: json.cities,
    land(c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return false
      const i = r * cols + c
      return ((bytes[i >> 3] ?? 0) >> (7 - (i & 7)) & 1) === 1
    },
  }
}

export type Crop = { x: number; y: number; w: number; h: number }

/** The phone crop of the 1440 x 900 map: the city bounding box plus padding, centred. The same absolute margin is left above and below. */
export function phoneCrop(cities: Record<string, [number, number]>): Crop {
  const pts = Object.values(cities)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const w = (x1 - x0) / (1 - 2 * PHONE_PAD)
  const h = y1 - y0 + 2 * PHONE_PAD * w
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h }
}

/** Milliseconds until the ripple reaches cell (c, r). The origin is in cell units; distance is measured in design px. */
export function rippleDelay(c: number, r: number, origin: [number, number], step: number): number {
  return Math.hypot(c - origin[0], r - origin[1]) * step * MS_PER_PX
}

/** The cell-unit coordinates of a design-px point (cell centres sit at (c + .5) * step). */
export function toCellUnits([x, y]: [number, number], step: number): [number, number] {
  return [x / step - 0.5, y / step - 0.5]
}

/** When the ripple passes each city, and when its tag drops: after the pass and at least 80 ms after the previous tag. */
export function cityTimings(grid: Pick<Grid, 'cities' | 'step'>, origin: string = ORIGIN_CITY): CityTiming[] {
  const from = grid.cities[origin]
  if (!from) throw new Error(`origin city ${origin} is not in the grid`)
  const o = toCellUnits(from, grid.step)
  const passes = Object.entries(grid.cities)
    .map(([name, [x, y]]) => ({ name, x, y, pass: rippleDelay(...toCellUnits([x, y], grid.step), o, grid.step) }))
    .sort((a, b) => a.pass - b.pass)
  let last = -TAG_GAP_MS
  return passes.map((p) => {
    const tag = Math.max(p.pass, last + TAG_GAP_MS)
    last = tag
    return { ...p, tag }
  })
}

/** Indexes (from `from` on) of the cities the ripple has passed by time t. Timings are sorted by pass time, so the result is contiguous. */
export function arcsReached(t: number, timings: readonly Pick<CityTiming, 'pass'>[], from = 0): number[] {
  const out: number[] = []
  for (let i = from; i < timings.length && (timings[i] as { pass: number }).pass <= t; i++) out.push(i)
  return out
}

type Layout = 'desktop' | 'phone'

/** Every land square to draw at the given canvas width (css px), sorted by the time the ripple reaches it. */
export function plotCells(grid: Grid, layout: Layout, width: number): Cell[] {
  const { cols, rows, step, cities } = grid
  const origin = toCellUnits(cities[ORIGIN_CITY] ?? [0, 0], step)
  const near = Object.values(cities)
  const crop = phoneCrop(cities)
  const k = layout === 'phone' ? width / crop.w : width / DESIGN_W
  const seen = new Map<string, Cell>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid.land(c, r)) continue
      const cx = (c + 0.5) * step
      const cy = (r + 0.5) * step
      const lit = near.some(([x, y]) => (cx - x) ** 2 + (cy - y) ** 2 < NEAR_PX ** 2)
      const delay = rippleDelay(c, r, origin, step)
      if (layout === 'desktop') {
        seen.set(`${c},${r}`, { x: cx * k, y: cy * k, lit, delay })
        continue
      }
      const gx = Math.round(((cx - 1 - crop.x) * k) / PHONE_PITCH)
      const gy = Math.round(((cy - 1 - crop.y) * k) / PHONE_PITCH)
      if (gx < 0 || gy < 0 || gx * PHONE_PITCH >= width || gy * PHONE_PITCH >= crop.h * k) continue
      const key = `${gx},${gy}`
      const prev = seen.get(key)
      // Top-left origin: the phone grid snaps squares to a 5 px pitch, so keep the earliest ripple time and prefer the lit one.
      seen.set(key, { x: gx * PHONE_PITCH + 1, y: gy * PHONE_PITCH + 1, lit: lit || !!prev?.lit, delay: Math.min(delay, prev?.delay ?? Infinity) })
    }
  }
  return [...seen.values()].sort((a, b) => a.delay - b.delay)
}
