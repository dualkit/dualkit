import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('package metadata', () => {
  it('ships the licence', () => {
    expect(pkg.files).toContain('LICENSE')
    expect(existsSync(new URL('../LICENSE', import.meta.url))).toBe(true)
  })

  it('needs a Node version Playwright runs on', () => {
    expect(pkg.engines).toEqual({ node: '>=18.18' })
  })
})
