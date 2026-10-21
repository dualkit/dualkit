import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { latestBenchMonth, listBenchMonths, loadBenchMonth, plannedBench } from '../lib/bench'

const valid = (month: string) => JSON.stringify({ month, generatedAt: 'x', ruleCount: 20, models: [] })

describe('bench loader', () => {
  it('lists months newest first and ignores other files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bench-'))
    writeFileSync(join(dir, '2026-11.json'), valid('2026-11'))
    writeFileSync(join(dir, '2026-12.json'), valid('2026-12'))
    writeFileSync(join(dir, 'notes.txt'), '')
    expect(listBenchMonths(dir)).toEqual(['2026-12', '2026-11'])
    expect(latestBenchMonth(dir)?.month).toBe('2026-12')
  })
  it('returns null for a missing folder or month', () => {
    expect(latestBenchMonth('/nope')).toBeNull()
    expect(loadBenchMonth('2026-01', '/nope')).toBeNull()
  })
  it('fails the build loudly on a corrupt month', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bench-'))
    writeFileSync(join(dir, '2026-11.json'), '{"month":"2026-11"}')
    expect(() => loadBenchMonth('2026-11', dir)).toThrow(/Bench data/)
  })
  it('refuses a month name that is not YYYY-MM', () => {
    expect(loadBenchMonth('../secrets')).toBeNull()
    expect(loadBenchMonth('2026-13')).toBeNull()
  })
})

describe('plannedBench', () => {
  it('counts the models and screens the next run will use', () => {
    const root = mkdtempSync(join(tmpdir(), 'bench-pkg-'))
    mkdirSync(join(root, 'prompts'))
    writeFileSync(join(root, 'models.json'), JSON.stringify([{ id: 'a' }, { id: 'b' }]))
    for (const s of ['otp', 'profile', 'address-form']) {
      writeFileSync(join(root, 'prompts', `${s}.json`), '{}')
      writeFileSync(join(root, 'prompts', `${s}.md`), '')
    }
    expect(plannedBench(root)).toEqual({ models: 2, screens: 3 })
  })
  it('reads the real bench package by default', () => {
    const p = plannedBench()
    expect(p?.models).toBeGreaterThan(0)
    expect(p?.screens).toBe(10)
  })
  it('returns null when the bench package is missing', () => {
    expect(plannedBench('/nope')).toBeNull()
  })
})
