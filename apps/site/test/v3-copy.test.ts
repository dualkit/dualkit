import { describe, expect, it } from 'vitest'
import { V3 } from '../lib/v3/copy'

type Entry = { value: string; path: string[] }

function strings(node: unknown, path: string[] = []): Entry[] {
  if (typeof node === 'string') return [{ value: node, path }]
  if (Array.isArray(node)) return node.flatMap((child, i) => strings(child, [...path, String(i)]))
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]))
  return []
}

const ALLOWED_CAPS = ['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'IBAN', 'MIT', 'UAX', 'ISO', 'CLI', 'RTL', 'LTR', 'UAE', 'npm', 'OSI']
const ARABIC = /[؀-ۿ]/
const all = strings(V3)

describe('V3 copy', () => {
  it('has no em dashes', () => {
    for (const { value, path } of all) expect(value, path.join('.')).not.toContain('—')
  })

  it('has no words in all caps except allowed tokens', () => {
    for (const { value, path } of all) {
      for (const word of value.split(/\s+/).map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))) {
        if (/^[A-Z]{3,}$/.test(word)) expect(ALLOWED_CAPS, `${path.join('.')}: ${word}`).toContain(word)
      }
    }
  })

  it('marks every Arabic string', () => {
    const arabic = all.filter((e) => ARABIC.test(e.value))
    expect(arabic.length).toBeGreaterThan(0)
    for (const { value, path } of arabic) {
      const marked = path.some((key) => key === 'ar' || key.endsWith('Ar'))
      expect(marked, `${path.join('.')}: ${value}`).toBe(true)
    }
  })

  it('keeps the headline', () => {
    expect(V3.hero.headline).toEqual(['Build for the Gulf.', 'In both directions.'])
  })
})
