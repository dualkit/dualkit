import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { UserError } from '../src/config'
import { toUrl } from '../src/target'

const here = dirname(fileURLToPath(import.meta.url))

describe('toUrl', () => {
  it('keeps http, https and file URLs', () => {
    expect(toUrl('https://example.com/ar')).toBe('https://example.com/ar')
    expect(toUrl('http://localhost:3000')).toBe('http://localhost:3000/')
  })
  it('turns an existing file path into a file URL', () => {
    expect(toUrl('fixtures/page.html', here)).toMatch(/^file:\/\/.+page\.html$/)
  })
  it('reads a one-letter prefix as a Windows drive, not a URL scheme', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dualkit-target-'))
    mkdirSync(join(dir, 'C:'))
    writeFileSync(join(dir, 'C:', 'page.html'), '<p>x</p>')
    expect(toUrl('C:/page.html', dir)).toMatch(/^file:\/\/.+page\.html$/)
  })
  it('rejects anything else with a clear message', () => {
    expect(() => toUrl('not a page')).toThrow(UserError)
    expect(() => toUrl('ftp://example.com')).toThrow(/http, https or a local HTML file/)
  })
})
