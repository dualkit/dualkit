import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { arcsReached, phoneCrop, cityTimings, decodeGrid, plotCells, rippleDelay, toCellUnits, type GridJson } from '../lib/v3/grid'

const json = JSON.parse(readFileSync(resolve(__dirname, '../public/v3/gulf-grid.json'), 'utf8')) as GridJson
const grid = decodeGrid(json)

describe('decodeGrid', () => {
  it('covers cols * rows cells and counts the generator land total', () => {
    expect(grid.cols * grid.rows).toBe(16000)
    let land = 0
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (grid.land(c, r)) land++
    expect(land).toBe(13137)
  })
  it('reads out of range as water', () => {
    expect(grid.land(-1, 0)).toBe(false)
    expect(grid.land(grid.cols, 0)).toBe(false)
  })
  it('keeps Dubai next to land', () => {
    const [x, y] = grid.cities.Dubai!
    const c = Math.floor(x / grid.step), r = Math.floor(y / grid.step)
    let near = false
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) near ||= grid.land(c + dc, r + dr)
    expect(near).toBe(true)
  })
})

describe('rippleDelay', () => {
  it('is 0 at the origin and 1.2 ms per px away', () => {
    expect(rippleDelay(10, 10, [10, 10], 9)).toBe(0)
    expect(rippleDelay(20, 10, [10, 10], 9)).toBeCloseTo(90 * 1.2)
    expect(rippleDelay(30, 10, [10, 10], 9)).toBeGreaterThan(rippleDelay(20, 10, [10, 10], 9))
  })
})

describe('cityTimings', () => {
  const t = cityTimings(grid)
  it('starts at Dubai and keeps tags 80 ms apart, never before the pass', () => {
    expect(t[0]!.name).toBe('Dubai')
    expect(t[0]!.pass).toBeCloseTo(0, 5)
    t.forEach((c, i) => {
      expect(c.tag).toBeGreaterThanOrEqual(c.pass)
      if (i) expect(c.tag - t[i - 1]!.tag).toBeGreaterThanOrEqual(80 - 1e-9)
    })
  })
  it('covers all seven cities', () => expect(t).toHaveLength(7))
  it('maps a point back to cell units', () => expect(toCellUnits([9 * 3.5, 9 * 4.5], 9)).toEqual([3, 4]))
})

describe('plotCells', () => {
  it('desktop keeps every land cell, sorted by delay, with some lit', () => {
    const cells = plotCells(grid, 'desktop', 1440)
    expect(cells).toHaveLength(13137)
    expect(cells.every((c, i) => !i || c.delay >= cells[i - 1]!.delay)).toBe(true)
    expect(cells.some((c) => c.lit)).toBe(true)
  })
  it('phone re-grids onto a 5 px pitch inside the crop', () => {
    const cells = plotCells(grid, 'phone', 390)
    expect(cells.length).toBeGreaterThan(200)
    expect(cells.length).toBeLessThan(13137)
    expect(cells.every((c) => (c.x - 1) % 5 === 0 && c.x < 392 && c.y < 200)).toBe(true)
  })
})

describe('arcsReached', () => {
  const t = cityTimings(grid)
  it('has only the origin at t=0 and everything at the end', () => {
    expect(arcsReached(0, t)).toEqual([0])
    expect(arcsReached(1e6, t)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
  it('resumes from a pointer without repeating', () => {
    const mid = t[3]!.pass
    expect(arcsReached(mid, t, 2)).toEqual([2, 3])
    expect(arcsReached(mid, t, 4)).toEqual([])
  })
})

describe('phoneCrop', () => {
  const crop = phoneCrop(grid.cities)
  it.each([320, 390, 600])('keeps every city 16 px inside the canvas and centred at %i px', (width) => {
    const k = width / crop.w
    const height = crop.h * k
    const pts = Object.values(grid.cities).map(([x, y]) => [(x - crop.x) * k, (y - crop.y) * k] as const)
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(16)
      expect(x).toBeLessThanOrEqual(width - 16)
      expect(y).toBeGreaterThanOrEqual(16)
      expect(y).toBeLessThanOrEqual(height - 16)
    }
    const xs = pts.map((p) => p[0])
    expect(Math.min(...xs) - (width - Math.max(...xs))).toBeCloseTo(0, 5)
  })
})
