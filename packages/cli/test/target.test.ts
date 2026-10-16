import { describe, expect, it } from 'vitest'
import { UserError } from '../src/config'
import { toUrl } from '../src/target'

describe('toUrl', () => {
  it('keeps http, https and file URLs', () => {
    expect(toUrl('https://example.com/ar')).toBe('https://example.com/ar')
    expect(toUrl('http://localhost:3000')).toBe('http://localhost:3000/')
  })
  it('turns an existing file path into a file URL', () => {
    expect(toUrl('test/fixtures/page.html', process.cwd())).toMatch(/^file:\/\/.+page\.html$/)
  })
  it('rejects anything else with a clear message', () => {
    expect(() => toUrl('not a page')).toThrow(UserError)
    expect(() => toUrl('ftp://example.com')).toThrow(/http, https or a local HTML file/)
  })
})
