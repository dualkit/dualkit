/**
 * Good examples from the skills, each as a verbatim `quote` plus a hand-written HTML equivalent
 * (JSX and TS cannot render). The shell supplies only lang="ar" dir="rtl", so anything else a
 * page needs has to appear here because a skill says it.
 */
export type Example = { skill: string; quote: string; html: string; css?: string }

const LRI = '⁦'
const PDI = '⁩'

export const EXAMPLES: Example[] = [
  {
    skill: 'dualkit-type-pairing',
    quote: `@font-face {
  font-family: 'Brand';
  src: url('/fonts/ibm-plex-sans-arabic-500.woff2') format('woff2');
  font-weight: 500;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
  size-adjust: 112%;
}`,
    // The skill never names a font stack for text, only the face, so text uses 'Brand' exactly as written there.
    css: `@font-face {
  font-family: 'Brand';
  src: url('/fonts/ibm-plex-sans-arabic-500.woff2') format('woff2');
  font-weight: 500;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
  size-adjust: 112%;
}
body { font-family: 'Brand'; }`,
    html: '<p>مرحبا بكم في المتجر</p>',
  },
  {
    skill: 'dualkit-type-pairing',
    quote: ':lang(ar) { letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }',
    css: ':lang(ar) { letter-spacing: 0; text-transform: none; font-style: normal; line-height: 1.7; }',
    html: '<p>أكمل الطلب</p>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: "<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>",
    // Renders as the shell's own <html lang="ar" dir="rtl">.
    html: '<p>مرحبا بكم</p>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: '<p>{t.phoneHint} <bdi dir="ltr">050 123 4567</bdi></p>',
    html: '<p>مثال <bdi dir="ltr">050 123 4567</bdi></p>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: 'A formatted Arabic amount (`1,234.50 د.إ`)',
    html: '<p>الإجمالي <bdi>1,234.50 د.إ</bdi></p>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: '<input dir="ltr" inputMode="tel" autoComplete="tel" className="text-start" />',
    css: '.text-start { text-align: start; }',
    html: '<input dir="ltr" inputmode="tel" autocomplete="tel" class="text-start">',
  },
  {
    skill: 'dualkit-bilingual-copy',
    quote: "few: 'لديك {count} عناصر في هذا الطلب',",
    // {count} filled with a digit, as the skill's .replace does.
    html: '<p>لديك 5 عناصر في هذا الطلب</p>',
  },
]

/** Fenced blocks that cannot render: TS-only import lines, and calls whose output is shown in comments. */
export const UNRENDERED: { skill: string; index: number; reason: string }[] = [
  { skill: 'dualkit-rtl-layout', index: 2, reason: 'rules reader counts only <bdi>/dir/unicode-bidi as isolation; LRI/PDI false positive, fixed in project 3' },
  { skill: 'dualkit-gulf-formats', index: 0, reason: 'TS import line' },
  { skill: 'dualkit-gulf-formats', index: 1, reason: 'formatMoney calls, output shown in comments' },
  { skill: 'dualkit-gulf-formats', index: 2, reason: 'formatHijri calls, output shown in comments' },
  { skill: 'dualkit-gulf-formats', index: 3, reason: 'parse calls, output shown in comments' },
]
