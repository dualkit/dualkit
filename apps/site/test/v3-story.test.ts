import { describe, expect, it } from 'vitest'
import { frameCamera, type Rect } from '../lib/v3/camera'
import { CHAPTERS, LOOP_MS, chapterAt, FIX_AT, CHECK_AT, INSTALL_AT, SPEC_FOLLOW, followFactor } from '../lib/v3/story'

describe('story timeline', () => {
  it('chapters are contiguous and cover 0..LOOP_MS', () => {
    expect(LOOP_MS).toBe(22650)
    expect(CHAPTERS[0]?.start).toBe(0)
    expect(CHAPTERS[CHAPTERS.length - 1]?.end).toBe(LOOP_MS)
    CHAPTERS.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start)
      if (i) expect(c.start).toBe(CHAPTERS[i - 1]?.end)
    })
  })
  it('runs in the story order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['broken', 'install', 'direction', 'bidi', 'type', 'hijri', 'money', 'iban', 'checked'])
  })
  it('starts broken and gives the IBAN 2800 ms', () => {
    expect(chapterAt(0).id).toBe('broken')
    const iban = CHAPTERS.find((c) => c.id === 'iban')!
    expect(iban.end - iban.start).toBe(2800)
  })
  it('finds the chapter for any moment, clamping outside the loop', () => {
    expect(chapterAt(INSTALL_AT).id).toBe('install')
    expect(chapterAt(INSTALL_AT - 1).id).toBe('broken')
    expect(chapterAt(FIX_AT[1]!).id).toBe('bidi')
    expect(chapterAt(CHECK_AT).id).toBe('checked')
    expect(chapterAt(-5).id).toBe('broken')
    expect(chapterAt(LOOP_MS + 900).id).toBe('checked')
  })
  it('keeps the prototype beats: install at 2.4 s, fixes from 4.2 s every 2.05 s', () => {
    expect(INSTALL_AT).toBe(2400)
    expect(FIX_AT).toEqual([4200, 6250, 8300, 10350, 12400, 14450])
    expect(CHECK_AT).toBe(17250)
  })
})

const inside = (r: Rect, box: Rect, eps = 1e-6) =>
  r.x >= box.x - eps && r.y >= box.y - eps && r.x + r.w <= box.x + box.w + eps && r.y + r.h <= box.y + box.h + eps
const project = (r: Rect, c: { scale: number; x: number; y: number }): Rect => ({ x: c.x + r.x * c.scale, y: c.y + r.y * c.scale, w: r.w * c.scale, h: r.h * c.scale })
const inset = (r: Rect, n: number): Rect => ({ x: r.x + n, y: r.y + n, w: r.w - 2 * n, h: r.h - 2 * n })

describe('frameCamera', () => {
  const safe: Rect = { x: 0, y: 0, w: 1120, h: 640 }
  const cases: Rect[] = [
    { x: 0, y: 0, w: 520, h: 360 },
    { x: 0, y: 136, w: 520, h: 48 },
    { x: 400, y: 300, w: 120, h: 40 },
    { x: -32, y: 0, w: 1400, h: 900 },
  ]
  it('never zooms past maxZoom', () => {
    for (const t of cases) for (const z of [0.5, 1, 1.3, 4]) expect(frameCamera(t, safe, z).scale).toBeLessThanOrEqual(z)
  })
  it('keeps the target inside the safe rect inset by 32 px', () => {
    for (const t of cases) expect(inside(project(t, frameCamera(t, safe, 1.3)), inset(safe, 32))).toBe(true)
  })
  it('caps a phone at 1.15', () => {
    const phone: Rect = { x: 0, y: 0, w: 334, h: 418 }
    const c = frameCamera({ x: 0, y: 136, w: 40, h: 20 }, phone, 1.15)
    expect(c.scale).toBeLessThanOrEqual(1.15)
  })
  it('centres the target when the bounds allow it', () => {
    const t: Rect = { x: 100, y: 100, w: 100, h: 50 }
    const c = frameCamera(t, safe, 1)
    const p = project(t, c)
    expect(p.x + p.w / 2).toBeCloseTo(560)
    expect(p.y + p.h / 2).toBeCloseTo(320)
  })
  it('clamps to the bounds that must stay in view, not just the target', () => {
    const bounds: Rect = { x: -32, y: 0, w: 584, h: 360 }
    const t: Rect = { x: 0, y: 0, w: 520, h: 48 }
    const c = frameCamera(t, safe, 1.3, { bounds })
    expect(inside(project(bounds, c), inset(safe, 32))).toBe(true)
  })
  it('takes a per-axis inset', () => {
    const phone: Rect = { x: 0, y: 0, w: 334, h: 418 }
    const bounds: Rect = { x: -4, y: 0, w: 528, h: 360 }
    const c = frameCamera(bounds, phone, 1.15, { inset: { x: 2, y: 16 } })
    expect(c.scale).toBeCloseTo(330 / 528)
    expect(inside(project(bounds, c), { x: 2, y: 16, w: 330, h: 386 })).toBe(true)
  })
})

describe('springAt', () => {
  it('matches springKeyframes sample for sample and keeps going past the settle time', async () => {
    const { springAt, springKeyframes } = await import('../lib/v3/spring')
    const at = springAt({ zeta: 0.75, settleMs: 550 })
    const kf = springKeyframes(0, 1, { zeta: 0.75, settleMs: 550, fps: 60 })
    kf.slice(0, -1).forEach((v, i) => expect(at((i * 1000) / 60)).toBeCloseTo(v, 9))
    expect(Math.abs(1 - at(760))).toBeLessThan(0.02)
    expect(at(0)).toBe(0)
  })
})

describe('followFactor', () => {
  it('closes 18% of the gap in one 60Hz frame', () => {
    expect(followFactor(SPEC_FOLLOW, 1000 / 60)).toBeCloseTo(0.18, 10)
  })
  it('covers the same ground at 120Hz over two frames as at 60Hz over one', () => {
    const half = followFactor(SPEC_FOLLOW, 1000 / 120)
    expect(1 - (1 - half) ** 2).toBeCloseTo(0.18, 10)
  })
  it('does not move on a zero or negative frame', () => {
    expect(followFactor(SPEC_FOLLOW, 0)).toBe(0)
    expect(followFactor(SPEC_FOLLOW, -4)).toBe(0)
  })
})
