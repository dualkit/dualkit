import { readFileSync } from 'node:fs'
import { parse } from 'node-html-parser'
import { describe, expect, it } from 'vitest'
import { INJECTORS, type BugKind } from '../src/inject.js'

const page = (name: string) => readFileSync(new URL(`./fixtures/pages/${name}.html`, import.meta.url), 'utf8')
const run = (kind: BugKind, name: string) => INJECTORS.find((i) => i.kind === kind)!.inject(page(name))

const KINDS: readonly BugKind[] = ['date-order', 'back-arrow', 'otp-digits', 'currency-side', 'cut-label', 'latin-punctuation', 'arabic-tracking', 'number-isolation']

describe('INJECTORS', () => {
  it('has one injector per kind, in order', () => {
    expect(INJECTORS.map((i) => i.kind)).toEqual(KINDS)
  })

  for (const kind of KINDS) {
    describe(kind, () => {
      it('changes a page it fits and marks exactly one element', () => {
        const input = page(kind)
        const out = run(kind, kind)!
        expect(out).not.toBe(input)
        expect(out.match(/data-eval-bug=/g)).toHaveLength(1)
        expect(out).toContain(`data-eval-bug="${kind}"`)
      })

      it('puts the marker first so it survives the 160 character snippet', () => {
        const el = parse(run(kind, kind)!).querySelector('[data-eval-bug]')!
        expect(el.outerHTML.slice(0, 160)).toContain(`data-eval-bug="${kind}"`)
        expect(el.outerHTML).toMatch(new RegExp(`^<[a-z0-9]+ data-eval-bug="${kind}"`))
      })

      it('returns null when nothing fits', () => {
        expect(run(kind, `${kind}-none`)).toBeNull()
      })
    })
  }

  it('leaves the rest of the page untouched', () => {
    const input = page('latin-punctuation')
    const out = run('latin-punctuation', 'latin-punctuation')!
    expect(out.replace(' data-eval-bug="latin-punctuation"', '').replace(',', '،').replace('?', '؟')).toBe(input)
  })

  it('date-order drops the isolation and writes a Western dashed date', () => {
    const out = run('date-order', 'date-order')!
    expect(out).toContain('<span data-eval-bug="date-order">15-03-2025</span>')
    expect(out).not.toContain('<bdi')
  })

  it('date-order handles a plain element with a slashed date', () => {
    const out = INJECTORS[0]!.inject('<p>الموعد 3/4/2025 م</p>')!
    expect(out).toBe('<p data-eval-bug="date-order">الموعد 3-4-2025 م</p>')
  })

  it('date-order turns a worded date into digits and dashes', () => {
    const out = INJECTORS[0]!.inject('<p>حدث في <bdi>١٥ مارس ٢٠٢٥</bdi></p>')!
    expect(out).toBe('<p>حدث في <span data-eval-bug="date-order">15-03-2025</span></p>')
  })

  it('number-isolation skips a bare number, whose reading order cannot change', () => {
    expect(INJECTORS[7]!.inject('<p>سنة <bdi>2025</bdi> هنا</p>')).toBeNull()
  })

  it('back-arrow mirrors an svg chevron and a text glyph', () => {
    expect(run('back-arrow', 'back-arrow')).toContain('<path d="M 9 19 l 7 -7 -7 -7"/>')
    const glyph = run('back-arrow', 'back-arrow-glyph')!
    expect(glyph).toContain('>←</button>')
    expect(glyph).toContain('<button data-eval-bug="back-arrow"')
  })

  it('back-arrow skips a symmetric shape', () => {
    const html = '<button aria-label="back"><svg viewBox="0 0 24 24"><path d="M12 5v14"/></svg></button>'
    expect(INJECTORS[1]!.inject(html)).toBeNull()
  })

  it('otp-digits adds a pattern and a digit stripper to the input', () => {
    const out = run('otp-digits', 'otp-digits')!
    expect(out).toContain('pattern="[0-9]*"')
    expect(out).toContain(`oninput="this.value=this.value.replace(/[^0-9]/g,'')"`)
  })

  it('otp-digits fits a group of single-digit boxes', () => {
    const box = '<input maxlength="1">'
    expect(INJECTORS[2]!.inject(`<div>${box.repeat(6)}</div>`)!.match(/data-eval-bug/g)).toHaveLength(1)
    expect(INJECTORS[2]!.inject(`<div>${box.repeat(2)}</div>`)).toBeNull()
  })

  it('currency-side moves the currency in both directions', () => {
    expect(run('currency-side', 'currency-side')).toContain('>ر.س ١٢٠</span>')
    expect(INJECTORS[3]!.inject('<p>السعر SAR 50</p>')).toContain('>السعر 50 SAR</p>')
  })

  it('cut-label truncates, giving an inline box a display that honours max-width', () => {
    expect(run('cut-label', 'cut-label')).toContain('style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 3em;"')
    expect(INJECTORS[4]!.inject('<p>اسم المستخدم الكامل</p><span>اسم المستخدم الكامل</span>')).not.toContain('<span data-eval-bug')
    expect(INJECTORS[4]!.inject('<span style="color:red">اسم المستخدم الكامل</span>')).toContain('style="color:red; white-space')
  })

  it('arabic-tracking adds letter spacing', () => {
    expect(run('arabic-tracking', 'arabic-tracking')).toContain('letter-spacing: 0.08em')
  })

  it('number-isolation removes bdi, dir and unicode-bidi', () => {
    const out = run('number-isolation', 'number-isolation')!
    expect(out).toContain('<span data-eval-bug="number-isolation">+966 50 123 4567</span>')
    const styled = INJECTORS[7]!.inject('<p>رقم <span dir="ltr" style="color:red;unicode-bidi:isolate">12-34</span> هنا</p>')!
    expect(styled).toContain('<span data-eval-bug="number-isolation" style="color:red">12-34</span>')
  })

  it('ignores script and style text', () => {
    expect(INJECTORS[5]!.inject('<script>var a = "نعم، تابع"</script><p>hi</p>')).toBeNull()
  })
})
