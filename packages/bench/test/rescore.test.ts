import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadScreens, ROOT } from '../src/config'
import { rescoreParts } from '../src/rescore'
import { makeStore, type BuildKey, type BuildRecord, type Round } from '../src/store'

const otp = loadScreens().filter((s) => s.id === 'otp')
const faithful = readFileSync(join(ROOT, 'test', 'fixtures', 'faithful-otp.html'), 'utf8')
const incomplete = readFileSync(join(ROOT, 'test', 'fixtures', 'incomplete.html'), 'utf8')
const key: BuildKey = { month: '2026-11', model: 'm', screen: 'otp', condition: 'dualkit', run: 1 }
const rec = (k: BuildKey, missing: string[], rounds?: Round[]): BuildRecord => ({
  ...k, at: 'a', reply: 'r', usage: null, ms: 0, finish: 'stop', reasoningTokens: 0, servedModel: 'm',
  ok: true, rulesPassed: 20, score: 90, missing, findings: [], unreadableStylesheets: 0, pageHeight: 800,
  ...(rounds ? { from: { rulesPassed: 20, score: 90 }, rounds } : {}),
})
const round = (missing: string[], lostParts: string[]): Round => ({
  at: 'a', ms: 0, usage: null, reply: 'r', ok: true, error: null, sent: 1, rulesPassed: 20, score: 90, missing, regressed: [], lostParts, arabicKept: 1,
})

describe('rescoreParts', () => {
  it('checks the parts again on stored pages and keeps everything else', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'rescore-')))
    store.write(rec(key, ['code boxes']), faithful)
    expect(await rescoreParts('2026-11', otp, store)).toBe(1)
    const next = store.read(key)!
    expect(next.ok && next.missing).toEqual([])
    expect(next.ok && next.score).toBe(90)
  }, 60_000)

  it('recomputes each loop round against the page before it', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'rescore-')))
    const loop: BuildKey = { ...key, condition: 'loop' }
    store.write(rec(key, ['code boxes']), faithful)
    store.write(rec(loop, [], [round([], []), round([], [])]), incomplete, null, [{ round: 1, html: faithful, shot: null }, { round: 2, html: incomplete, shot: null }])
    await rescoreParts('2026-11', otp, store)
    const next = store.read(loop)!
    if (!next.ok) throw new Error('expected ok')
    expect(next.rounds?.[0]).toMatchObject({ missing: [], lostParts: [] })
    expect(next.rounds?.[1]?.lostParts.length).toBeGreaterThan(0)
    expect(next.missing).toEqual(next.rounds?.[1]?.missing)
  }, 60_000)

  it('changes nothing when the parts are as stored', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'rescore-')))
    store.write(rec(key, []), faithful)
    expect(await rescoreParts('2026-11', otp, store)).toBe(0)
  }, 60_000)
})
