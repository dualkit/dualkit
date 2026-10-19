/**
 * Good examples from the skills, each as a verbatim `quote` plus a hand-written HTML equivalent
 * (JSX and TS cannot render). Each skill renders on its own page, because each is installed on its own.
 * The shell supplies only lang="ar" dir="rtl", so anything else a page needs has to appear here
 * because a skill says it.
 *
 * `cssFromQuote` uses the quote itself as the page CSS, so the two cannot drift. `css` is extra,
 * hand-written CSS. For a fenced block, the quotes together must cover every non-blank line.
 */
export type Example = { skill: string; quote: string; html: string; cssFromQuote?: boolean; css?: string }

export const EXAMPLES: Example[] = [
  {
    skill: 'dualkit-type-pairing',
    quote: `:lang(ar) {
  --type-label-size: 14px;
  --type-caption-size: 14px;
  --type-body-size: 16px;
  letter-spacing: 0;
  text-transform: none;
  font-style: normal;
  line-height: 1.7;
}
/* set the Latin sizes as the default, outside :lang(ar) */
body { font-size: var(--type-body-size); }
label, .badge, nav a { font-size: var(--type-label-size); }
small, .caption { font-size: var(--type-caption-size); }`,
    cssFromQuote: true,
    html: `<nav><a href="#">الطلبات</a></nav>
<label for="name">الاسم الكامل</label> <input id="name">
<p>أكمل الطلب <span class="badge">120 ر.س</span></p>
<small>السعر يشمل ضريبة القيمة المضافة</small>`,
  },
  {
    skill: 'dualkit-type-pairing',
    quote: `@font-face {
  font-family: 'Brand';
  src: url('/fonts/ibm-plex-sans-arabic-500.woff2') format('woff2');
  font-weight: 500;
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
  size-adjust: 112%;
}
/* then the Latin @font-face for 'Brand' with no unicode-range */
body { font-family: 'Brand', 'IBM Plex Sans Arabic', sans-serif; }`,
    cssFromQuote: true,
    html: '<p>مرحبا بكم في المتجر</p>',
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
    quote: '[dir="rtl"] .x { transform: translateX(100%) }',
    cssFromQuote: true,
    html: '<div class="x">القائمة</div>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: `<label>ميلادي:</label>
<label><bdi>Gregorian:</bdi></label>`,
    html: `<label>ميلادي:</label>
<label><bdi>Gregorian:</bdi></label>`,
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: `<td><bdi>1,234.50 (AED)</bdi></td>
<td><bdi>1,234.50 د.إ</bdi></td>`,
    // <td> only parses inside a table.
    html: `<table><tr><td><bdi>1,234.50 (AED)</bdi></td>
<td><bdi>1,234.50 د.إ</bdi></td></tr></table>`,
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: '<p dir="auto">Great service, thank you!</p>',
    html: '<p dir="auto">Great service, thank you!</p>',
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: `<input type="tel" dir="ltr" inputmode="tel" autocomplete="tel">
<input type="text" dir="auto" autocomplete="name">`,
    html: `<label for="phone">رقم الجوال</label> <input id="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel">
<label for="name">الاسم</label> <input id="name" type="text" dir="auto" autocomplete="name">`,
  },
  {
    skill: 'dualkit-rtl-layout',
    quote: '[dir="rtl"] .icon-directional { transform: scaleX(-1) }',
    cssFromQuote: true,
    html: '<button aria-label="التالي"><svg class="icon-directional" data-icon="chevron-right" width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor"/></svg></button>',
  },
  {
    skill: 'dualkit-bilingual-copy',
    quote: `const items = {
  zero: 'لا توجد عناصر في هذا الطلب',
  one: 'لديك عنصر واحد في هذا الطلب',
  two: 'لديك عنصران في هذا الطلب',
  few: 'لديك {count} عناصر في هذا الطلب',
  many: 'لديك {count} عنصرًا في هذا الطلب',
  other: 'لديك {count} عنصر في هذا الطلب',
}
const line = items[new Intl.PluralRules('ar').select(count)].replace('{count}', formatCount(count))`,
    // The block renders as the `few` sentence with {count} filled by a digit, as the .replace does.
    html: '<p>لديك 5 عناصر في هذا الطلب</p>',
  },
]

/** Fenced blocks that cannot render: TS-only import lines, calls whose output is shown in comments, and known reader gaps. */
export const UNRENDERED: { skill: string; index: number; quote: string; reason: string }[] = [
  {
    skill: 'dualkit-rtl-layout',
    index: 3,
    quote: 'const hint = `مثال ⁦050 123 4567⁩`',
    reason: 'rules reader counts only <bdi>/dir/unicode-bidi as isolation; LRI/PDI false positive, fixed in project 3',
  },
  { skill: 'dualkit-gulf-formats', index: 0, quote: "import { formatMoney,", reason: 'TS import line' },
  { skill: 'dualkit-gulf-formats', index: 1, quote: "formatMoney(1234.5, { currency: 'AED' })", reason: 'formatMoney calls, output shown in comments' },
  { skill: 'dualkit-gulf-formats', index: 2, quote: "formatHijri(dueDate, { timeZone: 'Asia/Dubai' })", reason: 'formatHijri calls, output shown in comments' },
  { skill: 'dualkit-gulf-formats', index: 3, quote: "parseUaePhone('٠٥٠ ١٢٣ ٤٥٦٧')", reason: 'parse calls, output shown in comments' },
]
