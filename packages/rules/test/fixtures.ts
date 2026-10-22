import { readFileSync } from 'node:fs'

const face = (file: string, weight: number): string =>
  `@font-face{font-family:"IBM Plex Sans Arabic";font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(new URL(`./fonts/${file}`, import.meta.url)).toString('base64')}) format("woff2")}`
const PLEX_FACES = face('IBMPlexSansArabic-Regular.woff2', 400) + face('IBMPlexSansArabic-Bold.woff2', 700)

type Page = { lang?: string | null; dir?: string | null; css?: string }

export const page = (body: string, o: Page = {}): string => {
  const lang = o.lang === undefined ? 'ar' : o.lang
  const dir = o.dir === undefined ? 'rtl' : o.dir
  const attrs = [lang === null ? '' : `lang="${lang}"`, dir === null ? '' : `dir="${dir}"`].join(' ')
  return `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>${PLEX_FACES}body{font-family:"IBM Plex Sans Arabic",sans-serif;font-size:16px;line-height:1.7}${o.css ?? ''}</style></head><body>${body}</body></html>`
}

const icon = (name: string, style = '') =>
  `<button><svg data-icon="${name}" style="${style}" width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg></button>`
const long = 'نص عربي طويل يمتد على عدة أسطر في هذه الفقرة الصغيرة'

export const FIXTURES: Record<string, { bad: string; good: string; moreGood?: string[]; moreBad?: string[] }> = {
  'bidi/unisolated-number': { bad: page('<p>رقم الهاتف 050 123 4567</p>'), good: page('<p>رقم الهاتف <bdi>050 123 4567</bdi></p>') },
  'bidi/unisolated-latin': { bad: page('<p>رقم الطلب #A-10293 تم</p>'), good: page('<p>رقم الطلب <bdi>#A-10293</bdi> تم</p>') },
  'bidi/date-order': {
    bad: page('<div dir="rtl"><span>٣-١١-٢٠٢٦</span></div>'),
    good: page('<div dir="rtl"><span>٣/١١/٢٠٢٦</span></div>'),
    moreBad: [
      page('<p>تاريخ الطلب 15-03-2025</p>'),
      page('<p>آخر تحديث <bdi dir="ltr">15 مارس 2025، 10:00 ص</bdi></p>'),
      page('<p>آخر تحديث <span style="direction:ltr;unicode-bidi:isolate">14 ربيع الأول 1447</span></p>'),
    ],
    moreGood: [
      page('<p>تاريخ الطلب 15/03/2025</p>'),
      page('<p>تاريخ الطلب <bdi dir="ltr">15-03-2025</bdi></p>'),
      page('<p>Date 15-03-2025</p>'),
      page('<p>آخر تحديث 15 مارس 2025، 10:00 ص</p>'),
      page('<p>Order placed on 15-03-2025 at 10:00 am.</p>', { lang: 'en', dir: 'ltr' }),
    ],
  },
  'bidi/punctuation-flip': { bad: page('<p>Hello world!</p>'), good: page('<p dir="ltr">Hello world!</p>') },
  'bidi/field-direction': { bad: page('<label>البريد <input type="email"></label>'), good: page('<label>البريد <input type="email" dir="ltr"></label>') },
  'bidi/field-placeholder': {
    bad: page('<input type="email" dir="ltr" placeholder="البريد الإلكتروني">'),
    good: page('<input type="email" dir="ltr" placeholder="البريد الإلكتروني">', { css: 'input:placeholder-shown{direction:rtl}' }),
  },
  'layout/physical-spacing': { bad: page('<div class="x">نص</div>', { css: '.x{margin-left:16px}' }), good: page('<div class="x">نص</div>', { css: '.x{margin-inline-start:16px}' }) },
  'layout/physical-inset': {
    bad: page('<div class="x">نص</div>', { css: '.x{position:absolute;left:8px;top:0}' }),
    good: page('<div class="x">نص</div>', { css: '.x{position:absolute;inset-inline-start:8px;top:0}' }),
  },
  'layout/text-align-left': { bad: page('<p>مرحبا</p>', { css: 'p{text-align:left}' }), good: page('<p>مرحبا</p>', { css: 'p{text-align:start}' }) },
  'layout/arabic-ltr-block': { bad: page('<p dir="ltr">مرحبا بكم في المتجر</p>'), good: page('<p>مرحبا بكم في المتجر</p>') },
  'layout/mirrored-text': {
    bad: page('<div style="transform:scaleX(-1)"><p>مرحبا بكم</p></div>'),
    good: page('<div style="transform:scaleX(-1)"><div style="transform:scaleX(-1)"><p>مرحبا بكم</p></div></div>'),
  },
  'layout/clipped-text': {
    bad: page('<div class="b">اشتري الآن واحصل على خصم</div>', { css: '.b{width:60px;overflow:hidden;white-space:nowrap}' }),
    good: page('<div class="b">اشتري الآن واحصل على خصم</div>', { css: '.b{width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' }),
    moreGood: [
      // Overflow that is only padding below fully visible lines.
      page('<div class="b"><p>اشتري الآن واحصل على خصم</p></div>', { css: '.b{height:60px;overflow:hidden}.b p{margin:0;padding-bottom:40px}' }),
      // A long sentence cut by an ellipsis at the end of a wide box shows most of itself.
      page(`<p class="s">${long}</p>`, { css: '.s{width:300px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' }),
      // A two-line clamp over a long paragraph.
      page(`<p class="c">${long} ${long} ${long} ${long}</p>`, { css: '.c{width:200px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}' }),
    ],
    // A short label an ellipsis cuts to a letter or two, with and without inline markup.
    moreBad: [
      page('<h1 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:3em">عنوان التوصيل</h1>'),
      page('<h1 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:3em">عنوان <span>التوصيل</span></h1>'),
    ],
  },
  'icons/not-mirrored': { bad: page(icon('arrow-right')), good: page(icon('arrow-right', 'transform:scaleX(-1)')) },
  'icons/mirrored-by-mistake': { bad: page(icon('play', 'transform:scaleX(-1)')), good: page(icon('play')) },
  'type/arabic-leading': {
    bad: page(`<p>${long}</p>`, { css: 'p{line-height:1.2;width:120px}' }),
    good: page(`<p>${long}</p>`, { css: 'p{line-height:1.7;width:120px}' }),
    moreGood: [
      // Display type.
      page(`<h2>${long}</h2>`, { css: 'h2{font-size:24px;line-height:1.2;width:160px}' }),
      // A carousel slide parked past the viewport's edge.
      page(`<div class="t"><p>${long}</p></div>`, { css: '.t{position:absolute;left:100vw;top:0}p{line-height:1.2;width:120px}' }),
    ],
    // Body text at 1.35 is still too tight for Arabic.
    moreBad: [page(`<p>${long}</p>`, { css: 'p{line-height:1.35;width:120px}' })],
  },
  'type/arabic-tracking': { bad: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0.1em}' }), good: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0}' }) },
  'type/arabic-italic': { bad: page('<p><em>مرحبا</em></p>'), good: page('<p><em style="font-style:normal">مرحبا</em></p>') },
  'type/arabic-font': { bad: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter",sans-serif}' }), good: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter","IBM Plex Sans Arabic",sans-serif}' }) },
  'type/arabic-faux-bold': {
    bad: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${face('IBMPlexSansArabic-Regular.woff2', 400)}p{font-family:"IBM Plex Sans Arabic",sans-serif;font-size:16px;line-height:1.7;font-weight:700}</style></head><body><p>مرحبا بكم</p></body></html>`,
    good: page('<p>مرحبا بكم</p>', { css: 'p{font-weight:700}' }),
  },
  'type/arabic-broken-join': {
    bad: page('<p>مح<span style="display:inline-block">مد</span></p>'),
    good: page('<p>مح<span style="color:red">مد</span></p>'),
    moreGood: [page('<p>مح<b>مد</b></p>'), page('<p>مح<span style="padding-inline-start:2px">مد</span></p>')],
  },
  'type/arabic-size': { bad: page('<p>مرحبا</p>', { css: 'p{font-size:12px}' }), good: page('<p>مرحبا</p>', { css: 'p{font-size:16px}' }) },
  'content/missing-lang': { bad: page('<p>مرحبا</p>', { lang: null }), good: page('<p>مرحبا</p>') },
  'content/missing-dir': { bad: page('<p>مرحبا بكم</p>', { dir: null }), good: page('<p>مرحبا بكم</p>') },
  'content/lang-mismatch': { bad: page('<p>مرحبا بكم</p>', { lang: 'en' }), good: page('<p>مرحبا بكم</p>') },
  'content/mixed-digits': { bad: page('<p>المبلغ 50 درهم</p><p>المبلغ ٥٠ درهم</p>'), good: page('<p>المبلغ 50 درهم</p><p>المبلغ 60 درهم</p>') },
  // dualkit-disable-next-line source/old-rial-sign -- the bad fixture for content/old-rial-sign
  'content/old-rial-sign': { bad: page('<p>١٠٠ \uFDFC</p>'), good: page('<p>١٠٠ ر.س</p>') },
  'content/currency-sign-font': {
    bad: page('<p>\u20C1 100</p>'),
    // The face is the fixture font again, declared for the sign's block: the rule judges what the page declares.
    good: page('<p>\u20C1 100</p>', { css: face('IBMPlexSansArabic-Regular.woff2', 400).replace('}', ';unicode-range:U+20C0-20CF}') }),
  },
  'content/dirham-sign-with-code': { bad: page('<p>\u20C3 500 AED</p>'), good: page('<p>\u20C3 500</p>') },
  'content/label-language': {
    bad: page('<button aria-label="Close the dialog">x</button>'),
    good: page('<button aria-label="إغلاق النافذة">x</button>'),
  },
  'content/latin-punctuation': {
    bad: page('<p>لا تشارك هذا الرمز مع أي شخص, بما في ذلك الدعم</p>'),
    good: page('<p>لا تشارك هذا الرمز مع أي شخص، بما في ذلك الدعم</p>'),
    moreBad: [page('<p>هل أنت متأكد?</p>'), page('<p>الاسم; العمر</p>')],
    moreGood: [
      page('<p>المبلغ 1,000 ريال</p>'),
      page('<p>نقبل iPhone, iPad وأجهزة أخرى</p>'),
      page('<p>هل أنت متأكد؟</p>'),
      page('<p>Are you sure, or not? Yes; no.</p>', { lang: 'en', dir: 'ltr' }),
    ],
  },
  'content/currency-order': {
    bad: page('<div class="price">د.إ 2.50</div>'),
    good: page('<div class="price">2.50 د.إ</div>'),
    moreBad: [page('<p>الإجمالي ريال ٣٠٠</p>'), page('<p>السعر <bdi>ر.ق 300</bdi></p>')],
    moreGood: [
      page('<p>السعر 300 ريال</p>'),
      page('<p>السعر AED 12</p>'),
      page('<p>السعر \u20C3 500</p>'),
      page('<p>Total: 300 riyal, or AED 12.</p>', { lang: 'en', dir: 'ltr' }),
    ],
  },
  'content/placeholder-text': { bad: page('<p>لوريم إيبسوم دولور</p>'), good: page('<p>مرحبا</p>') },
}
