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
    expect(run('back-arrow', 'back-arrow')).toContain('<path d="M 15 5 l -7 7 7 7"/>')
    const glyph = run('back-arrow', 'back-arrow-glyph')!
    expect(glyph).toContain('>←</button>')
    expect(glyph).toContain('<button data-eval-bug="back-arrow"')
  })

  it('back-arrow skips a symmetric shape', () => {
    const html = '<button aria-label="back"><svg viewBox="0 0 24 24"><path d="M12 5v14"/></svg></button>'
    expect(INJECTORS[1]!.inject(html)).toBeNull()
  })

  it('currency-side leaves a currency that is already before the number', () => {
    expect(INJECTORS[3]!.inject('<p>السعر ر.س ١٢٠</p>')).toBeNull()
    expect(INJECTORS[3]!.inject('<p>السعر SAR 50</p>')).toBeNull()
  })

  it('back-arrow keeps a leading relative moveto inside the viewBox and points it the other way', () => {
    const html = '<button aria-label="back"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>'
    const out = INJECTORS[1]!.inject(html)!
    expect(out).toContain('d="m 15 5 -7 7 7 7"')
  })

  it('back-arrow leaves an arrow that is already wrong', () => {
    const svg = '<button aria-label="رجوع"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>'
    expect(INJECTORS[1]!.inject(svg)).toBeNull()
    expect(INJECTORS[1]!.inject('<button aria-label="رجوع">←</button>')).toBeNull()
  })

  it('back-arrow reads a CSS flip on the svg class', () => {
    const style = '<style>:dir(rtl) .icon-directional { transform: scaleX(-1); }</style>'
    const left = '<button aria-label="رجوع"><svg class="icon-directional" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>'
    const right = left.replace('M15 18l-6-6 6-6', 'M9 6l6 6-6 6')
    // Drawn left and flipped is right, the correct back arrow, so it can be broken. Drawn right and flipped is already wrong.
    expect(INJECTORS[1]!.inject(style + left)).toContain('<svg data-eval-bug="back-arrow"')
    expect(INJECTORS[1]!.inject(style + right)).toBeNull()
  })

  it('back-arrow knows that a guillemet is mirrored in right-to-left text', () => {
    expect(INJECTORS[1]!.inject('<button aria-label="السابق">‹</button>')).toContain('>›</button>')
    expect(INJECTORS[1]!.inject('<button aria-label="السابق">›</button>')).toBeNull()
  })

  it('date-order uses Western digits after an Arabic letter and Arabic-Indic digits when no letter comes before', () => {
    expect(INJECTORS[0]!.inject('<div>تاريخ <span>15/03/2025</span></div>')).toContain('>15-03-2025<')
    expect(INJECTORS[0]!.inject('<div>15/03/2025</div>')).toContain('>١٥-٠٣-٢٠٢٥<')
  })

  it('date-order skips a Latin letter before the date, a version number, and a date that already reorders', () => {
    expect(INJECTORS[0]!.inject('<div>Order 15/03/2025</div>')).toBeNull()
    expect(INJECTORS[0]!.inject('<p>الإصدار 4.2.0</p>')).toBeNull()
    expect(INJECTORS[0]!.inject('<p>حدث في 2025-09-12</p>')).toBeNull()
    expect(INJECTORS[0]!.inject('<p>حدث في ٢٠٢٥-٠٩-١٢</p>')).toBeNull()
  })

  it('date-order skips a date a script rewrites at runtime', () => {
    expect(INJECTORS[0]!.inject('<p>تاريخ <b class="when">15/03/2025</b></p><script>document.querySelector(".when").textContent = x</script>')).toBeNull()
  })

  it('date-order sees a Tailwind flex row as separate items, not one flow', () => {
    const row = '<div class="flex justify-between"><span>تاريخ الحجز</span><span>15/03/2025</span></div>'
    expect(INJECTORS[0]!.inject(row)).toContain('>١٥-٠٣-٢٠٢٥<')
    expect(INJECTORS[0]!.inject(row.replace('flex justify-between', 'block'))).toContain('>15-03-2025<')
  })

  it('treats Arabic-Indic digits and punctuation as not being Arabic letters', () => {
    expect(INJECTORS[0]!.inject('<div>١٢، <span>15/03/2025</span></div>')).toContain('>١٥-٠٣-٢٠٢٥<')
  })

  it('number-isolation needs the number inline with Arabic text', () => {
    expect(INJECTORS[7]!.inject('<div style="display:flex"><span>رقم</span><bdi>+966 50</bdi></div>')).toBeNull()
    expect(INJECTORS[7]!.inject('<p>رقم <bdi>+966 50</bdi></p>')).toContain('data-eval-bug')
  })

  it('otp-digits skips a plain numeric input on a screen that is not asking for a code', () => {
    expect(INJECTORS[2]!.inject('<p>رقم الهاتف</p><input inputmode="numeric">')).toBeNull()
    expect(INJECTORS[2]!.inject('<p>أدخل رمز التحقق</p><input inputmode="numeric">')).toContain('pattern=')
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

  it('currency-side moves the currency before the number', () => {
    expect(run('currency-side', 'currency-side')).toContain('>ر.س ١٢٠</span>')
    expect(INJECTORS[3]!.inject('<p>السعر 50 SAR</p>')).toContain('>السعر SAR 50</p>')
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
