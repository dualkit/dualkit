import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BenchError } from '../src/config'
import { BASE_SYSTEM, checkSkills, systemPrompt } from '../src/system'

describe('systemPrompt', () => {
  it('is the base prompt alone', () => {
    expect(systemPrompt('alone')).toBe(BASE_SYSTEM)
  })
  it('adds the four design skills in folder order with Dualkit', () => {
    const s = systemPrompt('dualkit')
    const order = ['dualkit-bilingual-copy', 'dualkit-gulf-formats', 'dualkit-rtl-layout', 'dualkit-type-pairing'].map((n) => s.indexOf(`# Skill: ${n}`))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(s.startsWith(BASE_SYSTEM)).toBe(true)
  })
  it('leaves out the convert skill, which is not a design skill', () => {
    expect(systemPrompt('dualkit')).not.toContain('# Skill: dualkit-convert')
  })
})

describe('checkSkills', () => {
  it('accepts the committed skills', () => {
    expect(() => checkSkills()).not.toThrow()
  })
  it('names a skill folder with no SKILL.md', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skills-'))
    mkdirSync(join(dir, 'good'))
    writeFileSync(join(dir, 'good', 'SKILL.md'), '# good')
    mkdirSync(join(dir, 'broken'))
    expect(() => checkSkills(dir)).toThrow(BenchError)
    expect(() => checkSkills(dir)).toThrow(/broken/)
  })
  it('rejects a missing or empty skills folder', () => {
    expect(() => checkSkills(join(tmpdir(), 'no-such-skills-dir'))).toThrow(BenchError)
    expect(() => checkSkills(mkdtempSync(join(tmpdir(), 'skills-')))).toThrow(BenchError)
  })
})
