import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KNOWN_LIMITS, asCode, renderRulesMarkdown } from '../src/docs'
import { RULES } from '../src/rules'

const FILE = new URL('../RULES.md', import.meta.url)

describe('RULES.md', () => {
  it('matches the rules in code', () => {
    const expected = renderRulesMarkdown(RULES)
    if (process.env.UPDATE_RULES_MD) writeFileSync(FILE, expected)
    expect(readFileSync(FILE, 'utf8')).toBe(expected)
  })

  it('wraps HTML tags in prose in backticks so GitHub does not strip them', () => {
    const md = renderRulesMarkdown(RULES)
    expect(md).toContain('`<html>`')
    expect(md).toContain('`<bdi>`')
    expect(md.replace(/`[^`]*`/g, '')).not.toContain('<html>')
    expect(md.replace(/`[^`]*`/g, '')).not.toContain('<bdi>')
  })

  it('ends with a Known limits list, one bullet per limit, each in the same plain voice', () => {
    const md = renderRulesMarkdown(RULES)
    const tail = md.slice(md.indexOf('## Known limits'))
    expect(tail.startsWith('## Known limits\n\n')).toBe(true)
    expect(KNOWN_LIMITS.length).toBeGreaterThan(0)
    for (const limit of KNOWN_LIMITS) expect(tail).toContain(`- ${asCode(limit)}\n`)
    expect(tail.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(KNOWN_LIMITS.length)
    expect(md.indexOf('## Known limits')).toBeGreaterThan(md.indexOf('## Content'))
    expect(md).not.toContain('\u2014')
  })
})
