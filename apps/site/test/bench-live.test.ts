import { describe, expect, it } from 'vitest'
import { STALE_MS, clockUtc, currentRunWindow, emptyHeading, emptyState, formatCountdown, inPollWindow, isRunning, lastRunLabel, nextRunAt, parseProgress, progressUrl, runDayLabel } from '../lib/bench-live'

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
  it('points at the current UTC month on the bench-progress branch', () => {
    expect(progressUrl(at('2026-11-30T23:59:00Z'))).toBe('https://raw.githubusercontent.com/dualkit/dualkit/bench-progress/bench/runs/2026-11/progress.json')
  })
  it('takes an override', () => {
    expect(progressUrl(at('2026-11-01T00:00:00Z'), 'http://localhost:9000/p.json')).toBe('http://localhost:9000/p.json')
  })
})

describe('currentRunWindow', () => {
  it('is null at 04:16 on the 1st, before the run starts', () => {
    expect(currentRunWindow(at('2026-11-01T04:16:59Z'))).toBeNull()
  })
  it('is this month from 04:17 on the 1st', () => {
    expect(currentRunWindow(at('2026-11-01T04:17:00Z'))?.toISOString()).toBe('2026-11-01T04:17:00.000Z')
    expect(currentRunWindow(at('2026-11-01T04:18:00Z'))?.toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
  it('lasts to the end of the 3rd', () => {
    expect(currentRunWindow(at('2026-11-03T12:00:00Z'))?.toISOString()).toBe('2026-11-01T04:17:00.000Z')
    expect(currentRunWindow(at('2026-11-03T23:59:59Z'))?.toISOString()).toBe('2026-11-01T04:17:00.000Z')
  })
  it('is null from the 4th', () => {
    expect(currentRunWindow(at('2026-11-04T00:00:00Z'))).toBeNull()
    expect(currentRunWindow(at('2026-11-19T10:00:00Z'))).toBeNull()
  })
})

describe('inPollWindow', () => {
  it('is the 1st to the 3rd, UTC, whole days', () => {
    expect(inPollWindow(at('2026-11-01T00:00:00Z'))).toBe(true)
    expect(inPollWindow(at('2026-11-03T23:59:59Z'))).toBe(true)
  })
  it('is false the rest of the month', () => {
    expect(inPollWindow(at('2026-10-31T23:59:59Z'))).toBe(false)
    expect(inPollWindow(at('2026-11-04T00:00:00Z'))).toBe(false)
    expect(inPollWindow(at('2026-10-19T10:00:00Z'))).toBe(false)
  })
})

describe('emptyState', () => {
  it('names the next run before the window', () => {
    expect(emptyState(at('2026-10-19T10:00:00Z'))).toEqual({ month: '2026-11', day: '1 November', inWindow: false })
    expect(emptyState(at('2026-11-01T04:16:00Z'))).toEqual({ month: '2026-11', day: '1 November', inWindow: false })
  })
  it('keeps the current month on launch day, not next month', () => {
    expect(emptyState(at('2026-11-01T04:18:00Z'))).toEqual({ month: '2026-11', day: '1 November', inWindow: true })
    expect(emptyState(at('2026-11-03T20:00:00Z'))).toEqual({ month: '2026-11', day: '1 November', inWindow: true })
  })
  it('moves on to next month from the 4th', () => {
    expect(emptyState(at('2026-11-04T00:00:00Z'))).toEqual({ month: '2026-12', day: '1 December', inWindow: false })
  })
})

describe('emptyHeading', () => {
  it('names the day outside the window', () => {
    expect(emptyHeading({ day: '1 November', inWindow: false, running: false })).toBe('The first run lands on 1 November.')
  })
  it('says the run is under way in the window while the status says running', () => {
    expect(emptyHeading({ day: '1 November', inWindow: true, running: true })).toBe('The first run is under way.')
  })
  it('keeps the day in the window when the status does not say running', () => {
    expect(emptyHeading({ day: '1 November', inWindow: true, running: false })).toBe('The first run lands on 1 November.')
  })
})
