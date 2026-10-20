import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ClipNode, JoinBreak, LabelNode, LoadedFace, PlaceholderSide, SignProbe } from '../src'

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

describe('public types', () => {
  it('exports the model types every reader fills, so callers can type a ScreenModel by hand', () => {
    // A compile-time check: npm run typecheck fails if any of these is not exported from the package entry.
    const parts: [LoadedFace['status'], LabelNode['attr'], ClipNode['axis'], JoinBreak['reason'], SignProbe['codePoint'], PlaceholderSide] = ['loaded', 'alt', 'x', 'other', 0x20c1, 'left']
    expect(parts).toHaveLength(6)
  })
})
