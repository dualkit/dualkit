import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as api from '../src'

describe('package entry', () => {
  it('exports the engine, the registry and the docs helpers', () => {
    expect(typeof api.lint).toBe('function')
    expect(typeof api.lintText).toBe('function')
    expect(typeof api.lintDocsUrl).toBe('function')
    expect(typeof api.renderLintMarkdown).toBe('function')
    expect(Array.isArray(api.RULES)).toBe(true)
    expect(api.LINT_KNOWN_LIMITS.length).toBeGreaterThan(0)
  })

  it('ships the licence and LINT.md', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(pkg.files).toEqual(['dist', 'LINT.md', 'LICENSE'])
    expect(pkg.engines).toEqual({ node: '>=18.18' })
  })
})
