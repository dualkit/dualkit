import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BenchError, loadModels, loadScreens, ROOT, SCREENS } from '../src/config'

const tmp = () => mkdtempSync(join(tmpdir(), 'bench-'))

describe('loadModels', () => {
  it('loads the committed list with unique ids', () => {
    const models = loadModels()
    expect(models.length).toBeGreaterThanOrEqual(5)
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length)
  })
  it('gives every committed model a maker and a mark that exists in design/assets/marks', () => {
    for (const m of loadModels()) {
      expect(m.by.length).toBeGreaterThan(0)
      expect(readdirSync(join(ROOT, '..', '..', 'design', 'assets', 'marks'))).toContain(`${m.mark}.svg`)
    }
  })
  it('maps each committed model to its maker', () => {
    const by = Object.fromEntries(loadModels().map((m) => [m.id, `${m.by}/${m.mark}`]))
    expect(by).toEqual({
      'gemini-flash': 'Google/google', 'gemma-4-31b': 'Google/google', 'nemotron-3-ultra': 'NVIDIA/nvidia',
      'dots-3-note': 'Dots Studio/dots-studio', 'laguna-s': 'Poolside/poolside', 'north-mini-code': 'Cohere/cohere',
    })
  })
  it('rejects a model without by, or with a mark that is not a file in design/assets/marks', () => {
    const base = { id: 'x', provider: 'gemini', model: 'x', label: 'X', since: '2026-11', by: 'Google', mark: 'google' }
    const load = (patch: Record<string, unknown>) => {
      const file = join(tmp(), 'm.json')
      writeFileSync(file, JSON.stringify([{ ...base, ...patch }]))
      return () => loadModels(file)
    }
    expect(load({})).not.toThrow()
    expect(load({ by: '' })).toThrow(/by/)
    expect(load({ by: undefined })).toThrow(/by/)
    expect(load({ mark: undefined })).toThrow(/mark/)
    expect(load({ mark: 'acme' })).toThrow(/mark/)
    expect(load({ mark: '../google' })).toThrow(/mark/)
  })
  it('rejects an unknown provider', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'openai', model: 'x', label: 'X', since: '2026-11' }]))
    expect(() => loadModels(file)).toThrow(BenchError)
  })
  it('rejects a bad since month', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'gemini', model: 'x', label: 'X', since: 'Nov' }]))
    expect(() => loadModels(file)).toThrow(/since/)
  })
})

describe('loadScreens', () => {
  it('loads all five screens in order, each with a prompt and required parts', () => {
    const screens = loadScreens()
    expect(screens.map((s) => s.id)).toEqual([...SCREENS])
    for (const s of screens) {
      expect(s.prompt.length).toBeGreaterThan(100)
      expect(s.required.length).toBeGreaterThan(0)
      for (const r of s.required) expect(r.selector ?? r.text).toBeTruthy()
    }
  })
  it('compiles every text pattern', () => {
    for (const s of loadScreens()) for (const r of s.required) if (r.text) expect(() => new RegExp(r.text!)).not.toThrow()
  })
})
