import { describe, expect, it } from 'vitest'
import { V3 } from '../lib/v3/copy'

type Entry = { value: string; path: string[] }

function strings(node: unknown, path: string[] = []): Entry[] {
  if (typeof node === 'string') return [{ value: node, path }]
  if (Array.isArray(node)) return node.flatMap((child, i) => strings(child, [...path, String(i)]))
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]))
  return []
}

const ALLOWED_CAPS = ['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'IBAN', 'MIT', 'UAX', 'ISO', 'CLI', 'RTL', 'LTR', 'UAE', 'npm', 'OSI', 'MCP', 'GCC', 'VAT']
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

describe('V3 kit and previews', () => {
  it('lists every menu part in the kit, in the same order', () => {
    expect([V3.kit.open.name, ...V3.kit.rest]).toEqual(V3.menu.parts.map(([, name]) => name))
  })

  it('counts the parts in the kit heading', () => {
    expect(V3.kit.heading.startsWith('Eight parts')).toBe(true)
    expect(V3.kit.rest.length + 1).toBe(8)
  })

  it('takes the MCP and Figma rule counts from the code that runs them', async () => {
    const { RULES } = await import('@dualkit/rules')
    const { JSDOM_CHECKED } = await import('../../../packages/mcp/src/jsdom-coverage')
    const { CHECKED_IN_FIGMA } = await import('../../figma/src/coverage')
    const mcp = Object.fromEntries(V3.kit.previews.mcp.tools)
    expect(mcp.check_html).toBe(`${JSDOM_CHECKED.length} rules, no browser`)
    expect(mcp.rules).toBe(`the ${RULES.length} rules and their fixes`)
    expect(V3.kit.previews.mcp.status).toBe(`${V3.kit.previews.mcp.tools.length} tools`)
    expect(Object.fromEntries(V3.kit.previews.figma.commands)['Check frame']).toBe(`${CHECKED_IN_FIGMA.length} of ${RULES.length} rules`)
  })

  it('does not show Figma as live', () => {
    expect(V3.kit.previews.figma.status).toBe('Coming to Figma Community')
  })
})
