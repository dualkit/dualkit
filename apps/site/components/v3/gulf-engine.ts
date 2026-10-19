import { createClock } from '@/lib/v3/clock'
import { CROP, cityTimings, plotCells, type Cell, type CityTiming, type Grid } from '@/lib/v3/grid'

const PHONE_QUERY = '(max-width: 899px)'
const LAND_ALPHA = 0.3
const NEAR_ALPHA = 0.85
const PHONE_NEAR_ALPHA = 0.6
const ARC_ALPHA = 0.4
const ARC_LIFT = 28
const SQUARE = 2

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
  let end = 0
  let finished = false

  const square = (cell: Cell) => {
    ctx.globalAlpha = cell.lit ? (phone ? PHONE_NEAR_ALPHA : NEAR_ALPHA) : LAND_ALPHA
    const size = Math.max(1, Math.round(SQUARE * ratio))
    ctx.fillRect(Math.round(cell.x * ratio - size / 2), Math.round(cell.y * ratio - size / 2), size, size)
  }

  const arc = (city: CityTiming) => {
    const dubai = timings[0]
    if (!phone || !dubai || city === dubai) return
    const k = width / CROP.w
    const at = (x: number, y: number) => [(x - CROP.x) * k * ratio, (y - CROP.y) * k * ratio] as const
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
    show(t)
    if (!finished && t >= end) {
      finished = true
      clock.pause()
      root.dataset.done = ''
    }
  }

  const paint = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawn = 0
    const t = settled || finished ? Infinity : clock.now()
    advance(t)
    timings.forEach((c) => (t >= c.pass ? arc(c) : undefined))
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
    end = Math.max(cells.at(-1)?.delay ?? 0, ...timings.map((c) => c.tag)) + 1
    paint()
  }

  const ro = new ResizeObserver(measure)
  ro.observe(root)
  measure()
  const off = settled ? () => {} : clock.onTick((t) => advance(t))

  return {
    run(on) {
      if (settled || finished) return
      if (on) clock.play()
      else clock.pause()
    },
    destroy() {
      ro.disconnect()
      off()
      clock.pause()
    },
  }
}
