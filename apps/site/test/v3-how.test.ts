import { describe, expect, it } from 'vitest'
import { checkSchedule, pulseFrames, pulseSchedule, rankSchedule, ringFrames, ringOpacity } from '../lib/v3/how-schedule'

describe('pulseSchedule', () => {
  const s = pulseSchedule()
  it('runs three 900 ms pulses 300 ms apart then rests 1.2 s', () => {
    expect(s.pulses.map((p) => [p.start, p.end])).toEqual([[0, 900], [300, 1200], [600, 1500]])
    expect(s.cycle).toBe(1500 + 1200)
  })
  it('flashes the ring for 400 ms on each arrival', () => {
    expect(s.flashes).toEqual([{ at: 900, end: 1300 }, { at: 1200, end: 1600 }, { at: 1500, end: 1900 }])
  })
  it('ring rests at .4 and peaks at 1 mid flash', () => {
    expect(ringOpacity(0, s.flashes)).toBeCloseTo(0.4)
    expect(ringOpacity(1100, s.flashes)).toBeCloseTo(1)
    expect(ringOpacity(2400, s.flashes)).toBeCloseTo(0.4)
  })
  it('frames stay inside 0 to 1, rise in order and travel the full wire', () => {
    for (let w = 0; w < 3; w++) {
      const f = pulseFrames(s, w)
      expect(f[0]?.offset).toBe(0)
      expect(f[f.length - 1]?.offset).toBe(1)
      expect(f.map((x) => x.offset)).toEqual([...f.map((x) => x.offset)].sort((a, b) => a - b))
      expect(f.some((x) => x.distance === 1 && x.opacity === 1)).toBe(true)
    }
    const r = ringFrames(s)
    expect(r[0]?.offset).toBe(0)
    expect(r[r.length - 1]?.offset).toBe(1)
  })
})

describe('rankSchedule', () => {
  const s = rankSchedule()
  it('moves the list up before the bars fill', () => {
    expect(s.slide.end - s.slide.start).toBe(450)
    expect(s.bars[0]?.start).toBeGreaterThanOrEqual(s.enter.end)
  })
  it('fills bars 600 ms each, 150 ms apart', () => {
    expect(s.bars.map((b) => b.end - b.start)).toEqual([600, 600, 600])
    expect(s.bars.map((b) => b.start - (s.bars[0]?.start ?? 0))).toEqual([0, 150, 300])
  })
  it('highlights row 1 200 ms after its bar lands', () => {
    expect(s.highlight.start - (s.bars[0]?.end ?? 0)).toBe(200)
  })
})

describe('checkSchedule', () => {
  const s = checkSchedule()
  it('draws lines 500 ms each, 180 ms apart', () => {
    expect(s.lines.map((l) => l.start)).toEqual([0, 180, 360])
    expect(s.lines.every((l) => l.end - l.start === 500)).toBe(true)
  })
  it('blinks after the lines, then the button goes solid in 300 ms', () => {
    expect(s.blink.start).toBe(860)
    expect(s.button.start).toBe(s.blink.end)
    expect(s.button.end - s.button.start).toBe(300)
  })
})
