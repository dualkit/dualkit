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

export const FIXTURES: Record<string, { bad: string; good: string }> = {
  'bidi/unisolated-number': { bad: page('<p>رقم الهاتف 050 123 4567</p>'), good: page('<p>رقم الهاتف <bdi>050 123 4567</bdi></p>') },
  'bidi/unisolated-latin': { bad: page('<p>راسلنا على hi@example.com</p>'), good: page('<p>راسلنا على <bdi>hi@example.com</bdi></p>') },
  'bidi/punctuation-flip': { bad: page('<p>Hello world!</p>'), good: page('<p dir="ltr">Hello world!</p>') },
  'bidi/field-direction': { bad: page('<label>البريد <input type="email"></label>'), good: page('<label>البريد <input type="email" dir="ltr"></label>') },
  'layout/physical-spacing': { bad: page('<div class="x">نص</div>', { css: '.x{margin-left:16px}' }), good: page('<div class="x">نص</div>', { css: '.x{margin-inline-start:16px}' }) },
  'layout/physical-inset': {
    bad: page('<div class="x">نص</div>', { css: '.x{position:absolute;left:8px;top:0}' }),
    good: page('<div class="x">نص</div>', { css: '.x{position:absolute;inset-inline-start:8px;top:0}' }),
  },
  'layout/text-align-left': { bad: page('<p>مرحبا</p>', { css: 'p{text-align:left}' }), good: page('<p>مرحبا</p>', { css: 'p{text-align:start}' }) },
  'layout/arabic-ltr-block': { bad: page('<p dir="ltr">مرحبا بكم في المتجر</p>'), good: page('<p>مرحبا بكم في المتجر</p>') },
  'icons/not-mirrored': { bad: page(icon('arrow-right')), good: page(icon('arrow-right', 'transform:scaleX(-1)')) },
  'icons/mirrored-by-mistake': { bad: page(icon('play', 'transform:scaleX(-1)')), good: page(icon('play')) },
  'type/arabic-leading': { bad: page(`<p>${long}</p>`, { css: 'p{line-height:1.2;width:120px}' }), good: page(`<p>${long}</p>`, { css: 'p{line-height:1.7;width:120px}' }) },
  'type/arabic-tracking': { bad: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0.1em}' }), good: page('<p>مرحبا بكم</p>', { css: 'p{letter-spacing:0}' }) },
  'type/arabic-italic': { bad: page('<p><em>مرحبا</em></p>'), good: page('<p><em style="font-style:normal">مرحبا</em></p>') },
  'type/arabic-font': { bad: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter",sans-serif}' }), good: page('<p>مرحبا</p>', { css: 'p{font-family:"Inter","IBM Plex Sans Arabic",sans-serif}' }) },
  'type/arabic-faux-bold': {
    bad: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${face('IBMPlexSansArabic-Regular.woff2', 400)}p{font-family:"IBM Plex Sans Arabic",sans-serif;font-size:16px;line-height:1.7;font-weight:700}</style></head><body><p>مرحبا بكم</p></body></html>`,
    good: page('<p>مرحبا بكم</p>', { css: 'p{font-weight:700}' }),
  },
  'type/arabic-size': { bad: page('<p>مرحبا</p>', { css: 'p{font-size:12px}' }), good: page('<p>مرحبا</p>', { css: 'p{font-size:16px}' }) },
  'content/missing-lang': { bad: page('<p>مرحبا</p>', { lang: null }), good: page('<p>مرحبا</p>') },
  'content/missing-dir': { bad: page('<p>مرحبا بكم</p>', { dir: null }), good: page('<p>مرحبا بكم</p>') },
  'content/lang-mismatch': { bad: page('<p>مرحبا بكم</p>', { lang: 'en' }), good: page('<p>مرحبا بكم</p>') },
  'content/mixed-digits': { bad: page('<p>المبلغ 50 درهم</p><p>المبلغ ٥٠ درهم</p>'), good: page('<p>المبلغ 50 درهم</p><p>المبلغ 60 درهم</p>') },
  'content/placeholder-text': { bad: page('<p>لوريم إيبسوم دولور</p>'), good: page('<p>مرحبا</p>') },
}
