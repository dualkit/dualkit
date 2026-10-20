import { describe, expect, it } from 'vitest'
import { visit, staticLocales, staticObject, staticString } from '../../src/ast'
import { parseSource } from '../../src/parse'
import { RULES } from '../../src/rules'
import { lintText } from '../../src/run'

const IDS = ['source/intl-digits', 'source/islamic-calendar', 'source/hijri-time-zone']
const run = (id: string, code: string, path = 'a.ts') => lintText(path, code, { rules: RULES.filter((r) => r.id === id) })
const digits = (c: string, p?: string) => run('source/intl-digits', c, p)
const cal = (c: string, p?: string) => run('source/islamic-calendar', c, p)
const tz = (c: string, p?: string) => run('source/hijri-time-zone', c, p)

describe('registration', () => {
  it('registers three warnings with no em dashes', () => {
    const mine = RULES.filter((r) => IDS.includes(r.id))
    expect(mine.map((r) => [r.id, r.severity])).toEqual(IDS.map((id) => [id, 'warning']))
    for (const r of mine) expect(`${r.title}${r.why}${r.fix}`).not.toContain('—')
  })
  it('keeps the agreed wording', () => {
    const by = (id: string) => RULES.find((r) => r.id === id)!
    expect(by('source/intl-digits').why).toContain('45 and 46')
    expect(by('source/intl-digits').fix).toContain('latn')
    expect(by('source/islamic-calendar').fix).toContain('islamic-umalqura')
    expect(by('source/islamic-calendar').why).not.toContain('officially')
    expect(by('source/hijri-time-zone').fix).toContain('Asia/Riyadh')
  })
})

describe('ast helpers', () => {
  const expr = (code: string) => {
    const file = parseSource('x.ts', `(${code})`)!
    let found: any = null
    visit(file.js[0]!.ast.program, (n) => { if (!found && n.type === 'ExpressionStatement') found = (n as any).expression })
    return found
  }
  it('staticString', () => {
    expect(staticString(expr("'a'"))).toBe('a')
    expect(staticString(expr('`a`'))).toBe('a')
    expect(staticString(expr('`a${b}`'))).toBeNull()
    expect(staticString(expr('x'))).toBeNull()
  })
  it('staticLocales', () => {
    expect(staticLocales(expr("['ar', 'en']"))).toEqual(['ar', 'en'])
    expect(staticLocales(expr("'ar'"))).toEqual(['ar'])
    expect(staticLocales(expr("['ar', x]"))).toBeNull()
    expect(staticLocales(expr('[...x]'))).toBeNull()
    expect(staticLocales(expr('x'))).toBeNull()
  })
  it('staticObject', () => {
    expect([...staticObject(expr("({ a: 1, 'b': 2 })"))!.keys()]).toEqual(['a', 'b'])
    expect(staticObject(expr('({ ...o })'))).toBeNull()
    expect(staticObject(expr('({ [k]: 1 })'))).toBeNull()
    expect(staticObject(expr('({ m() {} })'))).toBeNull()
    expect(staticObject(expr('1'))).toBeNull()
  })
  it('visit skips comments', () => {
    const file = parseSource('x.ts', '// c\nconst a = 1 /* d */')!
    const types: string[] = []
    visit(file.js[0]!.ast, (n) => { types.push(n.type) })
    expect(types.some((t) => t.startsWith('Comment'))).toBe(false)
  })
})

describe('intl-digits', () => {
  it.each([
    "new Intl.NumberFormat('ar-AE')",
    "Intl.NumberFormat('ar')",
    "new Intl.DateTimeFormat(['ar-SA','en'])",
    "n.toLocaleString('ar-EG')",
    "d.toLocaleDateString('ar', { month: 'long', day: 'numeric' })",
    "d.toLocaleTimeString('ar-AE')",
    "new Intl.NumberFormat('AR-ae', { style: 'currency', currency: 'AED' })",
    "d?.toLocaleString('ar')",
    "const fmt = new Intl.NumberFormat('ar-AE', { style: 'currency', currency: 'AED' })",
    "new Intl.NumberFormat(`ar-AE`)",
  ])('fires on %s', (code) => {
    const hits = digits(code)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.column).toBe(code.indexOf(code.includes('const fmt') ? 'new' : code.startsWith('new') ? 'new' : code.startsWith('Intl') ? 'Intl' : code.startsWith('d?') ? 'd?' : code.startsWith('d') ? 'd' : 'n') + 1)
  })
  it.each([
    "new Intl.NumberFormat('ar-AE-u-nu-latn')",
    "new Intl.NumberFormat('ar-SA-u-ca-islamic-umalqura-nu-arab')",
    "new Intl.NumberFormat('ar', { numberingSystem: 'arab' })",
    "n.toLocaleString('ar', { numberingSystem: nu })",
    "new Intl.NumberFormat('en-AE')",
    "new Intl.NumberFormat('art')",
    "new Intl.NumberFormat(locale)",
    "const formatPrice = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' }).format(n)",
    "new Intl.NumberFormat('ar', { ...opts })",
    "new Intl.NumberFormat('ar', opts)",
    "new Intl.NumberFormat(undefined)",
    "new Intl.NumberFormat()",
    "user.toLocaleString()",
    "user.toLocaleString(locale)",
    "// new Intl.NumberFormat('ar')\nconst a = 1",
    "/* d.toLocaleString('ar') */ const a = 1",
    "const s = \"new Intl.NumberFormat('ar')\"",
    "new Intl.NumberFormat(['en', 'ar'])",
    "new Intl.NumberFormat(['ar', locale])",
    "new Foo.NumberFormat('ar')",
    "other.NumberFormat('ar')",
    "new Intl.PluralRules('ar')",
    "new Intl.RelativeTimeFormat('ar')",
    "x.format('ar')",
    "d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { timeZone: 'Asia/Riyadh', numberingSystem: 'latn' })",
  ])('stays quiet on %s', (code) => {
    expect(digits(code)).toEqual([])
  })
  it('stays quiet on date formats that ask only for text fields', () => {
    expect(digits("d.toLocaleDateString('ar', { month: 'long' })")).toEqual([])
    expect(digits("new Intl.DateTimeFormat('ar-AE', { weekday: 'short', timeZone: 'Asia/Dubai' })")).toEqual([])
    expect(digits("d.toLocaleString('ar-SA', { era: 'long', month: 'narrow' })")).toEqual([])
    expect(digits("d.toLocaleTimeString('ar', { dayPeriod: 'long' })")).toEqual([])
  })
  it('fires on date formats with a numeric field, a numeric month, or no options', () => {
    expect(digits("d.toLocaleDateString('ar', { month: 'long', day: 'numeric' })")).toHaveLength(1)
    expect(digits("d.toLocaleDateString('ar', { month: '2-digit' })")).toHaveLength(1)
    expect(digits("d.toLocaleDateString('ar', { month: m })")).toHaveLength(1)
    expect(digits("new Intl.DateTimeFormat('ar', { weekday: 'long', dateStyle: 'full' })")).toHaveLength(1)
    expect(digits("new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Dubai' })")).toHaveLength(1)
    expect(digits("new Intl.DateTimeFormat('ar')")).toHaveLength(1)
  })
  it('names the runtime change for bare ar and the locale difference for a regional tag', () => {
    const bare = digits("new Intl.NumberFormat('ar')")[0]!.message
    expect(bare).toContain('CLDR 45 to 46')
    const regional = digits("new Intl.NumberFormat('ar-AE')")[0]!.message
    expect(regional).toContain('ar-SA prints Arabic-Indic and ar-AE prints Latin')
    expect(regional).not.toContain('CLDR 45')
    expect(digits("new Intl.NumberFormat('ar-u-ca-gregory')")[0]!.message).toContain('CLDR 45 to 46')
  })
  it('reads a locale extension nu keyword after other keywords', () => {
    expect(digits("new Intl.NumberFormat('ar-u-ca-gregory-nu-latn')")).toEqual([])
    expect(digits("new Intl.NumberFormat('ar-u-ca-gregory')")).toHaveLength(1)
  })
  it('reads JSX and TSX and HTML script', () => {
    expect(digits("export const A = () => <b>{n.toLocaleString('ar-EG')}</b>", 'a.tsx')).toHaveLength(1)
    expect(digits("<script>new Intl.NumberFormat('ar')</script>", 'a.html')).toHaveLength(1)
    const html = "<p>x</p><script>new Intl.NumberFormat('ar')</script>"
    expect(digits(html, 'a.html')[0]!.column).toBe(html.indexOf('new') + 1)
  })
})

describe('islamic-calendar', () => {
  it.each([
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic' })",
    "d.toLocaleDateString('ar-SA-u-ca-islamic')",
    "d.toLocaleDateString('en', { calendar: 'islamic' })",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn')",
    "new Intl.DateTimeFormat(locale, { calendar: 'islamic' })",
    "user.toLocaleString(locale, { calendar: 'islamic' })",
    "d.toLocaleString(undefined, { calendar: \"islamic\", timeZone: 'Asia/Riyadh' })",
  ])('fires on %s', (code) => {
    expect(cal(code)).toHaveLength(1)
  })
  it.each([
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic-umalqura' })",
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic-civil' })",
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic-tbla' })",
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic-rgsa' })",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura')",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic-civil')",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic-tbla-nu-latn')",
    "const kind = 'islamic'",
    "const o = { calendar: 'islamic' }",
    "const t = { type: 'islamic' }; foo(t)",
    "new Intl.DateTimeFormat('ar', { calendar })",
    "new Intl.DateTimeFormat('ar', { ...o })",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { calendar: 'islamic-umalqura' })",
    "new Intl.NumberFormat('ar-SA-u-ca-islamic')",
    "/* new Intl.DateTimeFormat('ar', { calendar: 'islamic' }) */",
  ])('stays quiet on %s', (code) => {
    expect(cal(code)).toEqual([])
  })
  it('real shape stays quiet on all three', () => {
    const code = "const s = date.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { timeZone: 'Asia/Riyadh' })"
    expect(cal(code)).toEqual([])
    expect(tz(code)).toEqual([])
    expect(digits(code)).toHaveLength(1)
  })
})

describe('hijri-time-zone', () => {
  it.each([
    "new Intl.DateTimeFormat('ar-SA', { calendar: 'islamic-umalqura' })",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura')",
    "d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { month: 'long' })",
    "d.toLocaleDateString('en', { calendar: 'islamic' })",
    "d.toLocaleString(locale, { calendar: 'islamic-civil' })",
    "Intl.DateTimeFormat('ar', { calendar: 'islamic-tbla', dateStyle: 'full' })",
  ])('fires on %s', (code) => {
    expect(tz(code)).toHaveLength(1)
  })
  it.each([
    "new Intl.DateTimeFormat('ar-SA', { calendar: 'islamic-umalqura', timeZone: 'Asia/Riyadh' })",
    "d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { timeZone })",
    "new Intl.DateTimeFormat('ar', { calendar: 'gregory' })",
    "new Intl.DateTimeFormat('ar-SA')",
    "new Intl.DateTimeFormat('ar-SA-u-ca-gregory')",
    "new Intl.DateTimeFormat('ar', { calendar: 'islamic', ...o })",
    "new Intl.DateTimeFormat('ar', opts)",
    "new Intl.NumberFormat('ar-SA-u-ca-islamic')",
    "new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { calendar: 'gregory' })",
  ])('stays quiet on %s', (code) => {
    expect(tz(code)).toEqual([])
  })
  it('hits point at the call start', () => {
    const code = "const x = 1\nconst f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura')"
    const [hit] = tz(code)
    expect([hit!.line, hit!.column]).toEqual([2, 11])
  })
})
