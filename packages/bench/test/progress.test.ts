import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeProgressWriter, MAX_RECENT, progressOf, type RecentBuild } from '../src/progress'

const build = (n: number, patch: Partial<RecentBuild> = {}): RecentBuild => ({
  at: `2026-11-01T04:${String(n).padStart(2, '0')}:00.000Z`, model: 'm', label: 'M', by: 'Fake', mark: 'google', screen: 'otp', screenTitle: 'OTP',
  condition: 'alone', ok: true, rulesPassed: 12, error: null, ...patch,
})
const at = '2026-11-01T05:00:00.000Z'

describe('progressOf', () => {
  it('carries the month, running flag, counts and update time', () => {
    expect(progressOf({ month: '2026-11', running: true, total: 180, done: 7, updatedAt: at, finished: [] })).toEqual({
      month: '2026-11', running: true, total: 180, done: 7, updatedAt: at, recent: [],
    })
  })
  it('lists the newest finished build first', () => {
    const out = progressOf({ month: '2026-11', running: true, total: 9, done: 3, updatedAt: at, finished: [build(1), build(2), build(3)] })
    expect(out.recent.map((r) => r.at.slice(14, 16))).toEqual(['03', '02', '01'])
  })
  it('keeps only the last 10', () => {
    const finished = Array.from({ length: 14 }, (_, i) => build(i))
    const out = progressOf({ month: '2026-11', running: true, total: 20, done: 14, updatedAt: at, finished })
    expect(MAX_RECENT).toBe(10)
    expect(out.recent).toHaveLength(10)
    expect(out.recent[0]!.at).toBe(finished[13]!.at)
    expect(out.recent[9]!.at).toBe(finished[4]!.at)
  })
  it('clips an error to 80 characters and leaves a short one alone', () => {
    const out = progressOf({ month: '2026-11', running: false, total: 2, done: 2, updatedAt: at, finished: [build(1, { ok: false, rulesPassed: null, error: 'x'.repeat(200) }), build(2, { ok: false, rulesPassed: null, error: 'short' })] })
    expect(out.recent[1]!.error).toBe('x'.repeat(80))
    expect(out.recent[0]!.error).toBe('short')
  })
  it('does not change the list it is given', () => {
    const finished = [build(1), build(2)]
    progressOf({ month: '2026-11', running: true, total: 2, done: 2, updatedAt: at, finished })
    expect(finished.map((b) => b.at.slice(14, 16))).toEqual(['01', '02'])
  })
})

describe('makeProgressWriter', () => {
  it('writes progress.json atomically, in order, without interleaving, leaving no tmp file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prog-'))
    const file = join(dir, 'x', 'progress.json')
    const write = makeProgressWriter(file)
    const snaps = Array.from({ length: 20 }, (_, i) => progressOf({ month: '2026-11', running: true, total: 20, done: i, updatedAt: at, finished: [] }))
    await Promise.all(snaps.map((s) => write(s)))
    expect(JSON.parse(readFileSync(file, 'utf8')).done).toBe(19)
    expect(existsSync(`${file}.tmp`)).toBe(false)
    expect(readdirSync(join(dir, 'x'))).toEqual(['progress.json'])
  })
  it('reports a failed write to onError and keeps going', async () => {
    const errors: string[] = []
    const write = makeProgressWriter('/dev/null/nope/progress.json', (m) => errors.push(m))
    await write(progressOf({ month: '2026-11', running: true, total: 1, done: 0, updatedAt: at, finished: [] }))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('progress.json')
  })
})
