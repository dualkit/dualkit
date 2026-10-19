import { createClock } from '@/lib/v3/clock'
import { NEAR_RADIUS, proximityAlpha } from '@/lib/v3/region-select'
import { arcsReached, cityTimings, phoneCrop, plotCells, type Cell, type CityTiming, type Grid } from '@/lib/v3/grid'

export const PHONE_QUERY = '(max-width: 899px)'
/** The proximity effect needs a mouse: hover and a fine pointer. */
const FINE_QUERY = '(hover: hover) and (pointer: fine)'
const LAND_ALPHA = 0.3
const NEAR_ALPHA = 0.85
const PHONE_NEAR_ALPHA = 0.6
const ARC_ALPHA = 0.4
export const ARC_LIFT = 28
const SQUARE = 2

type Box = { l: number; t: number; r: number; b: number }
const union = (a: Box | null, b: Box | null): Box | null =>
  a && b ? { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) } : a ?? b

export type Engine = { run(on: boolean): void; destroy(): void }

/** Draws the dot-matrix map on a DPR-aware canvas and plays the ripple on one clock. Redraws only when the width (or pixel ratio) changes. */
export function createGulfEngine(root: HTMLElement, canvas: HTMLCanvasElement, grid: Grid, settled: boolean): Engine {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { run() {}, destroy() {} }
  const timings = cityTimings(grid)
  const pins = Array.from(root.querySelectorAll<HTMLElement>('[data-city]'))
  const ink = getComputedStyle(root).getPropertyValue('--v3-ink').trim() || '#09090b'
  const clock = createClock()
  let cells: Cell[] = []
  let phone = false
  let width = 0
  let ratio = 0
  let drawn = 0
  let arcsDrawn = 0
  let end = 0
  let finished = false
  let wanted = false
  // Proximity (desktop, mouse, motion allowed): the pointer in client px, and the map-px box last repainted around it.
  let pointer: { x: number; y: number } | null = null
  let lastBox: Box | null = null
  let buckets = new Map<string, number[]>()

  const baseAlpha = (cell: Cell) => (cell.lit ? (phone ? PHONE_NEAR_ALPHA : NEAR_ALPHA) : LAND_ALPHA)
  const square = (cell: Cell, alpha = baseAlpha(cell)) => {
    ctx.globalAlpha = alpha
    const size = Math.max(1, Math.round(SQUARE * ratio))
    ctx.fillRect(Math.round(cell.x * ratio - size / 2), Math.round(cell.y * ratio - size / 2), size, size)
  }

  const arc = (city: CityTiming) => {
    const dubai = timings[0]
    if (!phone || !dubai || city === dubai) return
    const crop = phoneCrop(grid.cities)
    const k = width / crop.w
    const at = (x: number, y: number) => [(x - crop.x) * k * ratio, (y - crop.y) * k * ratio] as const
    const [hx, hy] = at(dubai.x, dubai.y)
    const [x, y] = at(city.x, city.y)
    ctx.globalAlpha = ARC_ALPHA
    ctx.lineWidth = Math.max(1, Math.round(ratio))
    ctx.strokeStyle = ink
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.quadraticCurveTo((hx + x) / 2, Math.min(hy, y) - ARC_LIFT * ratio, x, y)
    ctx.stroke()
  }

  const show = (t: number) => {
    for (const pin of pins) {
      const timing = timings.find((c) => c.name === pin.dataset.city)
      if (!timing) continue
      if (timing.pass <= t) pin.classList.add('is-point')
      if (timing.tag <= t) pin.classList.add('is-in')
    }
  }

  /** Paints everything the ripple has reached by time t. Squares never overlap, so later frames only add. */
  const advance = (t: number) => {
    ctx.fillStyle = ink
    while (drawn < cells.length && (cells[drawn] as Cell).delay <= t) square(cells[drawn++] as Cell)
    for (const i of arcsReached(t, timings, arcsDrawn)) {
      arc(timings[i] as CityTiming)
      arcsDrawn = i + 1
    }
    show(t)
    if (!finished && t >= end) {
      finished = true
      root.dataset.done = ''
      sync()
    }
    if (pointer || lastBox) nearby()
  }

  /** The clock runs while the ripple plays in view, or while the pointer is over the map. */
  const sync = () => {
    if (settled) return
    if ((wanted && !finished) || pointer) clock.play()
    else clock.pause()
  }

  const key = (bx: number, by: number) => `${bx},${by}`
  const index = () => {
    buckets = new Map()
    cells.forEach((cell, i) => {
      const k = key(Math.floor(cell.x / NEAR_RADIUS), Math.floor(cell.y / NEAR_RADIUS))
      const list = buckets.get(k)
      if (list) list.push(i)
      else buckets.set(k, [i])
    })
  }

  /** Repaints the drawn squares inside the old and new pointer boxes, darker near the pointer. Squares never overlap, so clearing a box and redrawing it is exact. */
  const nearby = () => {
    const r = root.getBoundingClientRect()
    const at = pointer ? { x: pointer.x - r.left, y: pointer.y - r.top } : null
    const pad = NEAR_RADIUS + SQUARE
    const box = at ? { l: at.x - pad, t: at.y - pad, r: at.x + pad, b: at.y + pad } : null
    const area = union(lastBox, box)
    lastBox = box
    if (!area) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(Math.floor(area.l * ratio), Math.floor(area.t * ratio), Math.ceil((area.r - area.l) * ratio) + 1, Math.ceil((area.b - area.t) * ratio) + 1)
    ctx.fillStyle = ink
    for (let bx = Math.floor((area.l - SQUARE) / NEAR_RADIUS); bx <= Math.floor((area.r + SQUARE) / NEAR_RADIUS); bx++) {
      for (let by = Math.floor((area.t - SQUARE) / NEAR_RADIUS); by <= Math.floor((area.b + SQUARE) / NEAR_RADIUS); by++) {
        for (const i of buckets.get(key(bx, by)) ?? []) {
          if (i >= drawn) continue
          const cell = cells[i] as Cell
          if (cell.x < area.l - SQUARE || cell.x > area.r + SQUARE || cell.y < area.t - SQUARE || cell.y > area.b + SQUARE) continue
          square(cell, at ? proximityAlpha(baseAlpha(cell), Math.hypot(cell.x - at.x, cell.y - at.y)) : baseAlpha(cell))
        }
      }
    }
  }

  const paint = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawn = 0
    arcsDrawn = 0
    const t = settled || finished ? Infinity : clock.now()
    advance(t)
  }

  const measure = () => {
    const w = Math.round(root.clientWidth)
    const h = Math.round(root.clientHeight)
    const dpr = window.devicePixelRatio || 1
    if (!w || (w === width && dpr === ratio)) return
    width = w
    ratio = dpr
    phone = window.matchMedia(PHONE_QUERY).matches
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    cells = plotCells(grid, phone ? 'phone' : 'desktop', w)
    index()
    lastBox = null
    end = Math.max(cells.at(-1)?.delay ?? 0, ...timings.map((c) => c.tag)) + 1
    paint()
  }

  const ro = new ResizeObserver(measure)
  ro.observe(root)
  measure()
  const off = settled ? () => {} : clock.onTick((t) => advance(t))

  const fine = window.matchMedia(FINE_QUERY)
  const onMove = (e: PointerEvent) => {
    if (settled || phone || e.pointerType !== 'mouse' || !fine.matches) return
    const was = pointer
    pointer = { x: e.clientX, y: e.clientY }
    if (!was) sync()
  }
  const onLeave = () => {
    if (!pointer) return
    pointer = null
    // One last repaint puts the squares back to their own alpha, then the clock may rest.
    nearby()
    sync()
  }
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerleave', onLeave)

  return {
    run(on) {
      wanted = on
      sync()
    },
    destroy() {
      ro.disconnect()
      off()
      clock.pause()
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
    },
  }
}
