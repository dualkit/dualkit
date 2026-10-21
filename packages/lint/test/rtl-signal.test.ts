import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasRtlLocaleFiles, hasRtlSignal, isRtlLocalePath } from '../src/rtl-signal'

describe('hasRtlSignal', () => {
  it.each([
    '<html dir="rtl">', "<div dir={isRtl ? 'rtl' : 'ltr'} />", "const o = { dir: 'rtl' }", '<i className="rtl:mr-2" />',
    '.a:dir(rtl) { left: 0 }', '[dir=rtl] .a {}', '[dir="rtl"] .a {}', 'html.rtl .a {}', 'const x = isRTL',
  ])('is true for %s', (text) => expect(hasRtlSignal(text)).toBe(true))

  it.each(['ltr', 'shortly', 'control: 1', 'dir="ltr"', 'const rtlsdr = 1'])('is false for %s', (text) => expect(hasRtlSignal(text)).toBe(false))
})

describe('isRtlLocalePath', () => {
  it.each(['locales/ar.json', 'i18n/ar-SA.po', 'lang/he/common.json', 'translations/fa_IR.yml', 'ur.json', 'messages.ar.json'])('is true for %s', (p) =>
    expect(isRtlLocalePath(p)).toBe(true))
  it.each(['src/area.ts', 'car.json', 'locales/en.json', 'src/components/Button.tsx'])('is false for %s', (p) => expect(isRtlLocalePath(p)).toBe(false))
})

describe('hasRtlLocaleFiles', () => {
  const make = (files: string[]): string => {
    const root = mkdtempSync(join(tmpdir(), 'dualkit-rtl-'))
    for (const f of files) {
      mkdirSync(join(root, f, '..'), { recursive: true })
      writeFileSync(join(root, f), '')
    }
    return root
  }
  const none = () => false

  it('finds a locale file in a non-lintable format', () => expect(hasRtlLocaleFiles(make(['public/locales/ar/common.json']), none)).toBe(true))
  it('skips node_modules and ignored folders', () => {
    expect(hasRtlLocaleFiles(make(['node_modules/x/ar.json']), none)).toBe(false)
    expect(hasRtlLocaleFiles(make(['gen/ar.json']), (abs) => abs.endsWith('gen'))).toBe(false)
  })
  it('stops at depth 6', () => {
    expect(hasRtlLocaleFiles(make(['a/b/c/d/e/ar.json']), none)).toBe(true)
    expect(hasRtlLocaleFiles(make(['a/b/c/d/e/f/g/ar.json']), none)).toBe(false)
  })
})
