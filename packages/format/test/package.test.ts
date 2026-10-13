import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('package exports', () => {
  it('gives CommonJS consumers the .d.cts types', () => {
    expect(pkg.exports['.'].require).toEqual({ types: './dist/index.d.cts', default: './dist/index.cjs' })
  })

  it('gives ESM consumers the .d.ts types', () => {
    expect(pkg.exports['.'].import).toEqual({ types: './dist/index.d.ts', default: './dist/index.js' })
  })
})
