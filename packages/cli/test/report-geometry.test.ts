import { describe, expect, it } from 'vitest'
import { contentWindow, cropWindow, mergeMarks, narrowToContent, ringPercent, settleEdges } from '../src/report/geometry'
import { pinSize, placePins } from '../src/report/pins'

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('cropWindow', () => {
  it('centres a small element in a 360px wide window and keeps the ring on it', () => {
    const box = { x: 600, y: 400, width: 100, height: 20 }
    const win = cropWindow(box, 1280, 1600)
    expect(win).toEqual({ x: 470, y: 335, width: 360, height: 150 })
    const r = ringPercent(box, win)
    expect(r.left).toBeCloseTo(36.111, 2)
    expect(r.top).toBeCloseTo(43.333, 2)
    expect(r.width).toBeCloseTo(27.778, 2)
    expect(r.height).toBeCloseTo(13.333, 2)
  })

  it('leaves 60px either side of a wide element', () => {
    expect(cropWindow({ x: 300, y: 400, width: 500, height: 40 }, 1280, 1600).width).toBe(620)
  })

  it('clamps to the image so no empty area shows', () => {
    const win = cropWindow({ x: 1250, y: 5, width: 30, height: 10 }, 1280, 1600)
    expect(win.x + win.width).toBe(1280)
    expect(win.y).toBe(0)
    const tiny = cropWindow({ x: 0, y: 0, width: 10, height: 10 }, 200, 50)
    expect(tiny).toEqual({ x: 0, y: 0, width: 200, height: 50 })
  })
})

describe('contentWindow', () => {
  it('frames the union of the boxes with a margin, clamped to the image', () => {
    const win = contentWindow([{ x: 400, y: 100, width: 100, height: 20 }, { x: 700, y: 300, width: 50, height: 20 }], 1280, 1000, 40)
    expect(win).toEqual({ x: 360, y: 60, width: 430, height: 300 })
    expect(contentWindow([{ x: 0, y: 0, width: 10, height: 10 }], 1280, 1000, 40)).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })

  it('shows the whole image when there is nothing to frame', () => {
    expect(contentWindow([], 1280, 1000, 40)).toEqual({ x: 0, y: 0, width: 1280, height: 1000 })
  })
})

describe('mergeMarks', () => {
  it('merges findings on the same element into one ring with a combined label', () => {
    const box = { x: 10, y: 10, width: 80, height: 16 }
    const marks = mergeMarks([
      { n: 3, box, severity: 'error' },
      { n: 16, box: { ...box, width: 82 }, severity: 'warning' },
      { n: 7, box: { x: 10, y: 60, width: 80, height: 16 }, severity: 'warning' },
    ])
    expect(marks).toHaveLength(2)
    expect(marks[0]!.numbers).toEqual([3, 16])
    expect(marks[0]!.label).toBe('3·16')
    expect(marks[0]!.severity).toBe('error')
    expect(marks[0]!.box.width).toBe(82)
    expect(marks[1]!.numbers).toEqual([7])
  })

  it('keeps a small element inside a big one as its own ring', () => {
    const marks = mergeMarks([
      { n: 1, box: { x: 0, y: 0, width: 400, height: 50 }, severity: 'error' },
      { n: 2, box: { x: 300, y: 15, width: 16, height: 16 }, severity: 'warning' },
    ])
    expect(marks).toHaveLength(2)
  })
})

describe('placePins', () => {
  const win = { x: 0, y: 0, width: 600, height: 400 }

  it('puts a lone pin just outside the inline end of its ring, without a leader', () => {
    const marks = mergeMarks([{ n: 1, box: { x: 100, y: 100, width: 80, height: 20 }, severity: 'error' }])
    const [p] = placePins(marks, win, { pinHeight: 18, gap: 6 })
    expect(p!.rect.x).toBeGreaterThanOrEqual(186)
    expect(p!.rect.x).toBeLessThan(200)
    expect(p!.leader).toBe(false)
  })

  it('gives a crowded column of findings pins that overlap neither each other nor any ring', () => {
    const boxes = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 2, y: 100 + i * 14, width: 120, height: 12 }))
    const marks = mergeMarks(boxes.map((box, i) => ({ n: i + 1, box, severity: 'warning' as const })))
    expect(marks).toHaveLength(6)
    const placed = placePins(marks, win, { pinHeight: 18, gap: 4 })
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) expect(overlaps(a.rect, b.rect)).toBe(false)
      for (const m of marks) expect(overlaps(a.rect, m.box)).toBe(false)
      expect(a.rect.x).toBeGreaterThanOrEqual(0)
      expect(a.rect.x + a.rect.width).toBeLessThanOrEqual(600)
    }
    expect(placed.some((p) => p.leader)).toBe(true)
  })

  it('avoids space the page has painted on', () => {
    const marks = mergeMarks([{ n: 1, box: { x: 100, y: 100, width: 80, height: 20 }, severity: 'error' }])
    const busy = { x: 180, y: 60, width: 200, height: 100 }
    const [p] = placePins(marks, win, { pinHeight: 18, gap: 6, isClear: (r) => !overlaps(r, busy) })
    expect(overlaps(p!.rect, busy)).toBe(false)
    expect(p!.rect.x + p!.rect.width).toBeLessThanOrEqual(100)
  })

  it('sizes a combined pin wider than a single one', () => {
    expect(pinSize('3·16', 18).width).toBeGreaterThan(pinSize('3', 18).width)
    expect(pinSize('3', 18)).toEqual({ width: 18, height: 18 })
  })
})

describe('cropWindow inside the content', () => {
  it('shifts the window into the content span before clamping to the image', () => {
    const box = { x: 771, y: 144, width: 79, height: 20 }
    const win = cropWindow(box, 1280, 900, { x0: 430, x1: 874 })
    expect(win.width).toBe(360)
    expect(win.x + win.width).toBe(874)
  })

  it('centres on content narrower than the minimum width', () => {
    const win = cropWindow({ x: 500, y: 100, width: 40, height: 20 }, 1280, 900, { x0: 450, x1: 650 })
    expect(win.x + win.width / 2).toBe(550)
  })
})

describe('narrowToContent', () => {
  it('trims page background at the sides but keeps every box and a margin', () => {
    const win = { x: 374, y: 0, width: 532, height: 600 }
    expect(narrowToContent(win, { x0: 430, x1: 874 }, 24, [{ x: 430, y: 10, width: 420, height: 40 }])).toEqual({ x: 406, y: 0, width: 492, height: 600 })
    expect(narrowToContent(win, null, 24, [])).toEqual(win)
  })
})

describe('settleEdges', () => {
  const text = [{ x: 100, y: 40, width: 60, height: 14 }, { x: 300, y: 40, width: 80, height: 14 }]
  const isClear = (r: { x: number; y: number; width: number; height: number }) => !text.some((t) => overlaps(r, t))

  it('nudges a window whose edge would cut text in half to the nearest clean cut', () => {
    const box = { x: 300, y: 40, width: 80, height: 14 }
    const win = { x: 130, y: 0, width: 360, height: 120 }
    const out = settleEdges(win, box, 1280, 900, isClear)
    expect(isClear({ x: out.x, y: out.y, width: 1, height: out.height })).toBe(true)
    expect(isClear({ x: out.x + out.width - 1, y: out.y, width: 1, height: out.height })).toBe(true)
    expect(out.x).toBeGreaterThan(160)
    expect(out.x + out.width).toBeGreaterThanOrEqual(box.x + box.width)
    expect(out.width).toBe(360)
  })

  it('leaves the window alone when no clean cut keeps the element in view', () => {
    const win = { x: 130, y: 0, width: 360, height: 120 }
    expect(settleEdges(win, { x: 300, y: 40, width: 80, height: 14 }, 1280, 900, () => false)).toEqual(win)
  })
})
