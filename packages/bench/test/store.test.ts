import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeStore, type BuildKey, type BuildRecord } from '../src/store'

const key: BuildKey = { month: '2026-11', model: 'gemma-4-31b', screen: 'otp', condition: 'alone', run: 1 }
const okRec = (k: BuildKey): BuildRecord => ({ ...k, at: '2026-11-01T04:20:00Z', reply: 'r', usage: { input: 1, output: 2 }, ms: 5, ok: true, rulesPassed: 12, score: 30, missing: [], findings: [] })
const failRec = (k: BuildKey): BuildRecord => ({ ...k, at: '2026-11-01T04:20:00Z', reply: null, usage: null, ms: 5, ok: false, error: 'HTTP 429' })

describe('store', () => {
  it('lays builds out by month, model, screen and condition', () => {
    const s = makeStore('/r')
    expect(s.paths(key)).toEqual({ json: '/r/2026-11/gemma-4-31b/otp/alone-1.json', html: '/r/2026-11/gemma-4-31b/otp/alone-1.html' })
  })
  it('round-trips a record', () => {
    const s = makeStore(mkdtempSync(join(tmpdir(), 'store-')))
    s.write(okRec(key), '<html></html>')
    expect(s.read(key)).toEqual(okRec(key))
  })
  it('counts only successful builds as done', () => {
    const s = makeStore(mkdtempSync(join(tmpdir(), 'store-')))
    s.write(failRec(key), null)
    expect(s.isDone(key)).toBe(false)
    s.write(okRec(key), '<html></html>')
    expect(s.isDone(key)).toBe(true)
  })
  it('treats a corrupt record as not done and leaves it out of the list', () => {
    const root = mkdtempSync(join(tmpdir(), 'store-'))
    const s = makeStore(root)
    s.write(okRec({ ...key, run: 2 }), '<html></html>')
    s.write(okRec(key), '<html></html>')
    writeFileSync(s.paths(key).json, '{ half')
    expect(s.isDone(key)).toBe(false)
    expect(s.list('2026-11').map((r) => r.run)).toEqual([2])
  })
  it('lists nothing for a month that never ran', () => {
    expect(makeStore(mkdtempSync(join(tmpdir(), 'store-'))).list('2026-12')).toEqual([])
  })
})
