import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderRulesMarkdown } from '../src/docs'
import { RULES } from '../src/rules'

const FILE = new URL('../RULES.md', import.meta.url)

describe('RULES.md', () => {
  it('matches the rules in code', () => {
    const expected = renderRulesMarkdown(RULES)
    if (process.env.UPDATE_RULES_MD) writeFileSync(FILE, expected)
    expect(readFileSync(FILE, 'utf8')).toBe(expected)
  })
})
