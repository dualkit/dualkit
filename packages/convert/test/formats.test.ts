import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { formatEdits } from '../src/transforms/formats'

type Lib = 'next-intl' | 'react-i18next'

function run(text: string, lib: Lib = 'next-intl', path = 'app/orders/page.tsx', helper = 'lib/dualkit-locale.ts') {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = formatEdits(outcome.file, lib, helper)
  const out = applyEdits(text, result.edits)
  const reparsed = parseSourceOutcome(path, out)
  if (!('file' in reparsed)) throw new Error(`output does not parse: ${reparsed.error}`)
  return { ...result, out }
}

const hooked = (body: string): string =>
  `import { useTranslations } from 'next-intl'\n\nexport function Order({ placed }: { placed: Date }) {\n  const t = useTranslations()\n${body}\n}\n`

describe('formatEdits locale literals', () => {
  it('rewrites toLocaleDateString in a hooked component and adds useLocale and the helper import', () => {
    const { out, flags } = run(hooked("  return <p>{placed.toLocaleDateString('en-US')}</p>"))
    expect(out).toContain('placed.toLocaleDateString(dkIntlLocale(locale))')
    expect(out).toContain('  const t = useTranslations()\n  const locale = useLocale()\n')
    expect(out).toContain("import { useTranslations, useLocale } from 'next-intl'")
    expect(out).toContain("import { dkIntlLocale } from '../../lib/dualkit-locale'")
    expect(flags).toEqual([])
  })

  it('rewrites Intl.NumberFormat and Intl.DateTimeFormat and adds the locale once', () => {
    const { out } = run(hooked("  const n = new Intl.NumberFormat('en-GB').format(3)\n  const d = Intl.DateTimeFormat('en').format(new Date())\n  return <p>{n}{d}</p>"))
    expect(out).toContain('new Intl.NumberFormat(dkIntlLocale(locale))')
    expect(out).toContain('Intl.DateTimeFormat(dkIntlLocale(locale))')
    expect(out.match(/const locale = useLocale\(\)/g)).toHaveLength(1)
  })

  it('uses getLocale in an async server component', () => {
    const text = "import { getTranslations } from 'next-intl/server'\n\nexport default async function Page() {\n  const t = await getTranslations()\n  return <p>{new Date().toLocaleTimeString('en-US')}</p>\n}\n"
    const { out } = run(text)
    expect(out).toContain('  const locale = await getLocale()\n')
    expect(out).toContain("import { getTranslations, getLocale } from 'next-intl/server'")
    expect(out).toContain('toLocaleTimeString(dkIntlLocale(locale))')
  })

  it('uses i18n.language with react-i18next', () => {
    const text = "import { useTranslation } from 'react-i18next'\n\nexport function Total({ n }: { n: number }) {\n  const { t } = useTranslation()\n  return <p>{n.toLocaleString('en-US')}</p>\n}\n"
    const { out } = run(text, 'react-i18next', 'src/routes/Total.tsx', 'src/lib/dualkit-locale.ts')
    expect(out).toContain('  const { t } = useTranslation()\n  const { i18n } = useTranslation()\n')
    expect(out).toContain('n.toLocaleString(dkIntlLocale(i18n.language))')
    expect(out).toContain("import { dkIntlLocale } from '../lib/dualkit-locale'")
  })

  it('flags a literal locale outside a hooked component and leaves it', () => {
    const text = "export function formatDate(d: Date) {\n  return d.toLocaleDateString('en-US')\n}\n\nexport function Card() {\n  return <p>{new Date().toLocaleDateString('en-US')}</p>\n}\n"
    const { out, flags } = run(text)
    expect(out).toBe(text)
    expect(flags.map((f) => [f.kind, f.line])).toEqual([['format', 2], ['format', 6]])
  })

  it('leaves non-English and non-literal locales alone', () => {
    const { edits, flags } = run(hooked("  return <p>{placed.toLocaleDateString('fr-FR')}{placed.toLocaleDateString(lang)}</p>"))
    expect(edits).toEqual([])
    expect(flags).toEqual([])
  })

  it('does nothing on a second run', () => {
    const first = run(hooked("  return <p>{placed.toLocaleDateString('en-US')}</p>")).out
    expect(run(first).edits).toEqual([])
  })

  it('flags a locale name clash and leaves the literal', () => {
    const { edits, flags } = run(hooked("  const locale = 'x'\n  return <p>{placed.toLocaleDateString('en-US')}{locale}</p>"))
    expect(edits).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(['format'])
  })
})

describe('formatEdits suggestions', () => {
  it('flags a call that formats in the browser locale, and leaves it', () => {
    const { edits, flags } = run(hooked('  const n = new Intl.NumberFormat()\n  return <p>{placed.toLocaleDateString()} {placed.toLocaleString(undefined, { month: \'long\' })} {n.format(1)}</p>'))
    expect(edits).toEqual([])
    expect(flags.map((f) => [f.kind, f.line])).toEqual([['format', 5], ['format', 6], ['format', 6]])
    expect(flags[1]).toMatchObject({
      message: 'This formats in the browser\'s own locale, so an Arabic page can show an English date or number, such as 11/1/2026 for 1 November.',
      suggestion: 'Pass dkIntlLocale(locale) from lib/dualkit-locale as the locale, so the format follows the page language.',
    })
    const vite = run("import { useTranslation } from 'react-i18next'\nexport function A({ d }) {\n  const { t } = useTranslation()\n  return <p>{d.toLocaleDateString()}</p>\n}\n", 'react-i18next', 'src/A.tsx', 'src/lib/dualkit-locale.ts')
    expect(vite.flags[0]!.suggestion).toBe('Pass dkIntlLocale(i18n.language) from src/lib/dualkit-locale as the locale, so the format follows the page language.')
  })

  it('flags currency USD with the AED and VAT suggestion', () => {
    const { flags, edits } = run(hooked("  return <p>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(4)}</p>"))
    expect(edits).toEqual([])
    expect(flags).toHaveLength(1)
    expect(flags[0]!.kind).toBe('format')
    expect(flags[0]!.suggestion).toMatch(/AED/)
    expect(flags[0]!.suggestion).toMatch(/VAT/)
  })

  it('flags a date picker from a known library with the Saturday and Hijri suggestion', () => {
    const text = "import { DayPicker } from 'react-day-picker'\n\nexport function Pick() {\n  return <DayPicker mode=\"single\" />\n}\n"
    const { flags } = run(text)
    expect(flags).toHaveLength(1)
    expect(flags[0]!.kind).toBe('format')
    expect(flags[0]!.suggestion).toMatch(/Saturday/)
    expect(flags[0]!.suggestion).toMatch(/Hijri/)
  })

  it('writes flag copy without em dashes', () => {
    const text = "import DatePicker from 'react-datepicker'\nconst f = { currency: 'USD' }\nexport function A() {\n  return <DatePicker />\n}\nexport const d = (x: Date) => x.toLocaleDateString('en-US')\n"
    for (const f of run(text).flags) expect(`${f.message}${f.suggestion}`).not.toContain('—')
  })
})
