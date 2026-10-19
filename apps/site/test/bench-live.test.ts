import { describe, expect, it } from 'vitest'
import { STALE_MS, clockUtc, formatCountdown, isRunning, lastRunLabel, nextRunAt, parseProgress, progressUrl, runDayLabel } from '../lib/bench-live'

const at = (iso: string) => new Date(iso)

describe('nextRunAt', () => {
  it('is later the same day before 04:17 on the 1st', () => {
    expect(nextRunAt(at('2026-11-01T03:00:00Z')).toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
  it('is next month once 04:17 on the 1st has passed', () => {
    expect(nextRunAt(at('2026-11-01T04:17:00Z')).toISOString()).toBe('2026-12-01T04:17:00.000Z')
    expect(nextRunAt(at('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-12-01T04:17:00.000Z')
  })
  it('is the 1st of next month mid month', () => {
    expect(nextRunAt(at('2026-10-19T10:00:00Z')).toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
  it('rolls 31 December over to 1 January', () => {
    expect(nextRunAt(at('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T04:17:00.000Z')
  })
})

describe('formatCountdown', () => {
  it('shows days, then hours, minutes and seconds', () => {
    expect(formatCountdown(((12 * 24 + 4) * 3600 + 12 * 60 + 33) * 1000)).toBe('12d 04:12:33')
  })
  it('drops the days under a day', () => {
    expect(formatCountdown((4 * 3600 + 5) * 1000)).toBe('04:00:05')
  })
  it('rounds down and never goes below zero', () => {
    expect(formatCountdown(1999)).toBe('00:00:01')
    expect(formatCountdown(-5000)).toBe('00:00:00')
  })
})

describe('labels', () => {
  it('names the last run the British way, in UTC', () => {
    expect(lastRunLabel('2026-11-01T04:17:09Z')).toBe('1 November, 04:17 UTC')
  })
  it('names the run day', () => {
    expect(runDayLabel(at('2026-11-01T04:17:00Z'))).toBe('1 November')
  })
  it('gives a build time as HH:MM UTC', () => {
    expect(clockUtc('2026-11-01T06:41:59Z')).toBe('06:41')
  })
  it('returns null for a time it cannot read', () => {
    expect(lastRunLabel('x')).toBeNull()
    expect(clockUtc('x')).toBeNull()
  })
})

const good = {
  month: '2026-11', running: true, total: 180, done: 112, updatedAt: '2026-11-01T06:41:00Z',
  recent: [{ at: '2026-11-01T06:41:00Z', model: 'gemma', label: 'Gemma 4 31B', by: 'Google', mark: 'google', screen: 'order-history', screenTitle: 'Order history', condition: 'dualkit', ok: true, rulesPassed: 18, error: null }],
}

describe('parseProgress', () => {
  it('accepts the runner file', () => {
    expect(parseProgress(good)).toEqual(good)
  })
  it('rejects anything else', () => {
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress('nope')).toBeNull()
    expect(parseProgress({ ...good, done: 'x' })).toBeNull()
    expect(parseProgress({ ...good, recent: 'x' })).toBeNull()
    expect(parseProgress({ ...good, recent: [{ ...good.recent[0], condition: 'maybe' }] })).toBeNull()
    expect(parseProgress({ ...good, recent: [{ ...good.recent[0], rulesPassed: '18' }] })).toBeNull()
  })
  it('keeps an error build', () => {
    const failed = { ...good.recent[0], ok: false, rulesPassed: null, error: 'No page in the reply' }
    expect(parseProgress({ ...good, recent: [failed] })?.recent[0]?.error).toBe('No page in the reply')
  })
})

describe('isRunning', () => {
  const p = parseProgress(good)!
  it('is true while running and fresh', () => {
    expect(isRunning(p, at('2026-11-01T07:00:00Z'))).toBe(true)
  })
  it('is false once the file is older than 40 minutes', () => {
    expect(STALE_MS).toBe(40 * 60_000)
    expect(isRunning(p, at('2026-11-01T07:21:01Z'))).toBe(false)
  })
  it('is false when the runner says it stopped, or there is no file', () => {
    expect(isRunning({ ...p, running: false }, at('2026-11-01T06:42:00Z'))).toBe(false)
    expect(isRunning(null, at('2026-11-01T06:42:00Z'))).toBe(false)
  })
  it('is false for an unreadable time', () => {
    expect(isRunning({ ...p, updatedAt: 'x' }, at('2026-11-01T06:42:00Z'))).toBe(false)
  })
})

describe('progressUrl', () => {
  it('points at the current UTC month on GitHub', () => {
    expect(progressUrl(at('2026-11-30T23:59:00Z'))).toBe('https://raw.githubusercontent.com/dualkit/dualkit/main/bench/runs/2026-11/progress.json')
  })
  it('takes an override', () => {
    expect(progressUrl(at('2026-11-01T00:00:00Z'), 'http://localhost:9000/p.json')).toBe('http://localhost:9000/p.json')
  })
})
