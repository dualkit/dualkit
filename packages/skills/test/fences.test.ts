import { describe, expect, it } from 'vitest'
import { bannedIn, fencesOf, undefinedCalls } from './fences'

describe('fencesOf', () => {
  it('skips blocks under Common mistakes', () => {
    const md = '## A\n```css\na{}\n```\n## Common mistakes\n```css\nb{}\n```\n'
    expect(fencesOf('s', md).map((f) => f.code.trim())).toEqual(['a{}'])
  })
  it('records language, section and index', () => {
    const md = '## A\n```css\na{}\n```\n## B\n```tsx\n<p/>\n```\n'
    expect(fencesOf('s', md)).toEqual([
      { skill: 's', lang: 'css', code: 'a{}\n', section: 'A', index: 0 },
      { skill: 's', lang: 'tsx', code: '<p/>\n', section: 'B', index: 1 },
    ])
  })
})

describe('bannedIn', () => {
  it.each(['text-xs', 'text-[11px]', 'text-[0.75rem]', 'tracking-wide', 'font-size: 12px', 'font-size: 0.75rem', '--text-small: 12px'])('bans %s', (s) =>
    expect(bannedIn(s)).not.toEqual([]))
  it.each(['text-sm', 'text-[14px]', 'tracking-normal', 'font-size: 14px', 'font-size: 1rem', '--text-small: 14px', 'size-adjust: 112%'])('allows %s', (s) =>
    expect(bannedIn(s)).toEqual([]))
  it.each(['letter-spacing: 0.05em', 'letter-spacing: 1px', 'letter-spacing:-0.02em', 'h1 { letter-spacing: .1em }'])('bans %s', (s) =>
    expect(bannedIn(s)).not.toEqual([]))
  it.each(['letter-spacing: 0', 'letter-spacing: normal', 'letter-spacing: 0;', ':lang(ar) { letter-spacing: 0 }'])('allows %s', (s) =>
    expect(bannedIn(s)).toEqual([]))
})

describe('undefinedCalls', () => {
  it('flags a call to an undefined helper', () =>
    expect(undefinedCalls('x.replace("{c}", formatCount(n))', new Set())).toEqual(['formatCount']))
  it('accepts a helper declared in the block', () =>
    expect(undefinedCalls('const formatCount = (n) => n\nformatCount(1)', new Set())).toEqual([]))
  it('accepts known exports and globals', () =>
    expect(undefinedCalls('formatMoney(1); new Intl.PluralRules("ar").select(2); String(1)', new Set(['formatMoney']))).toEqual([]))
})
