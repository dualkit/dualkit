import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LINT_KNOWN_LIMITS, renderLintMarkdown } from '../src/docs'
import { RULES } from '../src/rules'
import { wordRule } from './helpers'

const FILE = new URL('../LINT.md', import.meta.url)

describe('LINT.md', () => {
  it('matches the rules in code', () => {
    const expected = renderLintMarkdown(RULES)
    if (process.env.UPDATE_LINT_MD) writeFileSync(FILE, expected)
    expect(readFileSync(FILE, 'utf8')).toBe(expected)
  })

  it('ends with a Known limits list, one bullet per limit, with no em dashes', () => {
    const md = renderLintMarkdown(RULES)
    const tail = md.slice(md.indexOf('## Known limits'))
    expect(tail.startsWith('## Known limits\n\n')).toBe(true)
    expect(LINT_KNOWN_LIMITS.length).toBeGreaterThan(0)
    expect(tail.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(LINT_KNOWN_LIMITS.length)
    expect(md).not.toContain('\u2014')
  })

  it('renders each rule with an anchor that matches its docs link, and wraps HTML tags in code', () => {
    const rule = { ...wordRule('source/physical-css', 'x'), why: 'A <style> block is read.' }
    const md = renderLintMarkdown([rule])
    expect(md).toContain('<a id="source-physical-css"></a>\n### `source/physical-css` No x')
    expect(md).toContain('**warning.** A `<style>` block is read.')
    expect(md).toContain('**Fix:** Remove x.')
    expect(md.indexOf('## Source')).toBeLessThan(md.indexOf('## Known limits'))
  })
})
