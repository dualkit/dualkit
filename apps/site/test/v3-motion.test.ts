import { describe, expect, it } from 'vitest'
import { createClock } from '../lib/v3/clock'
import { odometerColumns } from '../lib/v3/odometer'
import { springKeyframes } from '../lib/v3/spring'

describe('springKeyframes', () => {
  it('underdamped: ends at target with 1.5 to 4% overshoot and settles in time', () => {
    const v = springKeyframes(0, 100, { zeta: 0.75, settleMs: 550 })
    expect(v[0]).toBe(0)
    expect(v[v.length - 1]).toBe(100)
    const max = Math.max(...v)
    expect(max).toBeGreaterThan(101.5)
    expect(max).toBeLessThan(104)
    let settled = v.length - 1
    while (settled > 0 && Math.abs((v[settled - 1] ?? 0) - 100) <= 2) settled--
    expect(settled).toBeLessThanOrEqual(0.6 * 60)
  })
  it('critically damped never exceeds the target', () => {
    const v = springKeyframes(0, 100, { zeta: 1, settleMs: 400 })
    expect(Math.max(...v)).toBeLessThanOrEqual(100)
    expect(v[v.length - 1]).toBe(100)
  })
})

describe('odometerColumns', () => {
  it('aligns digits from the right and passes non-digits through', () => {
    const cols = odometerColumns('1234.5', '1,234.50')
    expect(cols).toHaveLength(8)
    expect(cols[7]).toEqual({ char: '0', fromDigit: null, toDigit: 0 })
    expect(cols[1]).toEqual({ char: ',', fromDigit: null, toDigit: null })
    expect(cols[6]).toEqual({ char: '5', fromDigit: 5, toDigit: 5 })
  })
})

describe('createClock', () => {
  const fake = () => {
    let t = 0
    let id = 0
    const q = new Map<number, (ts: number) => void>()
    return {
      raf: (cb: (ts: number) => void) => { q.set(++id, cb); return id },
      cancel: (i: number) => { q.delete(i) },
      now: () => t,
      advance(ms: number) {
        t += ms
        const cbs = [...q.values()]
        q.clear()
        cbs.forEach((cb) => cb(t))
      },
    }
  }
  it('seek sets now()', () => {
    const f = fake()
    const c = createClock(f)
    c.seek(1200)
    expect(c.now()).toBe(1200)
  })
  it('ticks while playing, not after pause', () => {
    const f = fake()
    const c = createClock(f)
    const seen: number[] = []
    c.onTick((t) => seen.push(t))
    c.play()
    f.advance(16)
    f.advance(16)
    expect(seen).toEqual([16, 32])
    c.pause()
    f.advance(16)
    expect(seen).toHaveLength(2)
    c.play()
    f.advance(10)
    expect(seen[2]).toBe(42)
  })
  it('unsubscribe stops callbacks', () => {
    const f = fake()
    const c = createClock(f)
    let n = 0
    const off = c.onTick(() => n++)
    c.play()
    f.advance(16)
    off()
    f.advance(16)
    expect(n).toBe(1)
  })
})
