import { describe, expect, it } from 'vitest'
import { BASE_SYSTEM, systemPrompt } from '../src/system'

describe('systemPrompt', () => {
  it('is the base prompt alone', () => {
    expect(systemPrompt('alone')).toBe(BASE_SYSTEM)
  })
  it('adds the four skills in folder order with Dualkit', () => {
    const s = systemPrompt('dualkit')
    const order = ['dualkit-bilingual-copy', 'dualkit-gulf-formats', 'dualkit-rtl-layout', 'dualkit-type-pairing'].map((n) => s.indexOf(`# Skill: ${n}`))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(s.startsWith(BASE_SYSTEM)).toBe(true)
  })
})
