// The Starter section once it ships: three directions for Sam to pick from, desktop in context and mobile on its own.
// Run: node gen/v2/starter-section.mjs, which writes specs/starter-section-{a,b,c}-{desktop,mobile}.json.
// Component visuals follow the approved "Dualkit Starter" file, redrawn on the site's own tokens.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { V2 } from './copy.mjs'
import { LINE, band, col, hline, icon, row, text, vline } from './parts.mjs'
import { formatSection, formatTile, mirror } from './home.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export const STARTER = {
  install: 'npm i @dualkit/starter',
  a: {
    heading: 'A design system\nthat reads both ways.',
    lede: 'Eight React components on one token file. Copy them into your app and Arabic already works: mirrored layout, Arabic digits, Hijri dates and AED.',
    toggle: ['English', 'العربية'],
  },
  b: {
    heading: 'Copy it in.\nIt already speaks Arabic.',
    lede: 'Eight components, each built in both directions from the start. Install the tokens, copy the components, and ship.',
    copyIn: 'or copy the components into your app',
  },
  c: {
    heading: 'Change one token.\nBoth languages follow.',
    lede: 'One token file generates the Figma variables and the CSS. Change a value and Figma, code, English and Arabic move together.',
    values: ['4', '8', '12', '999'],
    active: 2,
  },
  components: [
    ['Button', 'Arrows flip with the reading direction.'],
    ['Field', 'Emails and IBANs stay left to right.'],
    ['Digit input', 'Takes Arabic digits; the boxes never reverse.'],
    ['Amount', 'AED and SAR in either digit system.'],
    ['Date', 'Gregorian and Hijri, on Gulf time.'],
    ['Tabs', 'Order and arrow keys follow the direction.'],
    ['Sheet', 'Opens from the side reading ends on.'],
    ['Toast', 'Mixed Arabic and English, in the right order.'],
  ],
}

// Lines inside the components, as in the approved Starter file.
export const C = {
  next: { En: 'Continue', Ar: 'متابعة' },
  more: { En: 'Learn more', Ar: 'اعرف المزيد' },
  email: { En: 'Email', Ar: 'البريد الإلكتروني' },
  help: { En: 'We only use it to send receipts.', Ar: 'نستخدمه لإرسال الإيصالات فقط.' },
  code: { En: 'Verification code', Ar: 'رمز التحقق' },
  digits: { En: ['4', '8', '2'], Ar: ['٤', '٨', '٢'] },
  total: { En: 'Total due', Ar: 'المبلغ المستحق' },
  aed: { En: 'AED 1,250.00', Ar: '١٬٢٥٠٫٠٠ د.إ' },
  vat: { En: 'Including 5% VAT', Ar: 'شامل ضريبة القيمة المضافة ٥٪' },
  greg: { En: 'Tue, 13 Oct 2026', Ar: 'الثلاثاء، ١٣ أكتوبر ٢٠٢٦' },
  hijri: { En: '2 Jumada al-Awwal 1448 AH', Ar: '٢ جمادى الأولى ١٤٤٨ هـ' },
  tabs: { En: ['Overview', 'Payments', 'Settings'], Ar: ['نظرة عامة', 'المدفوعات', 'الإعدادات'] },
  sheet: { En: 'Payment details', Ar: 'تفاصيل الدفع' },
  rows: { En: [['Amount', 'AED 1,250.00'], ['Reference', 'INV-2041']], Ar: [['المبلغ', '١٬٢٥٠٫٠٠ د.إ'], ['المرجع', 'INV-2041']] },
  cancel: { En: 'Cancel', Ar: 'إلغاء' },
  pay: { En: 'Pay now', Ar: 'ادفع الآن' },
  toast: { En: 'Sent AED 250.00 to Sam Santos.', Ar: 'تم إرسال ٢٥٠٫٠٠ د.إ إلى Sam Santos.' },
  undo: { En: 'Undo', Ar: 'تراجع' },
}

const GLYPH = {
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="#09090b" stroke-width="1.5" stroke-linecap="round"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.75" y="3.75" width="10.5" height="9.5" rx="1.5" stroke="#09090b" stroke-width="1.5"/><path d="M2.75 6.75h10.5M5.5 2.25v2.5M10.5 2.25v2.5" stroke="#09090b" stroke-width="1.5" stroke-linecap="round"/></svg>',
}
export const glyph = (name, tint = 'color.text.primary') => ({ shape: `${name} icon`, kind: 'svg', size: ['size.icon', 'size.icon'], svg: GLYPH[name], tint })

// Script helpers: Arabic rows run reversed and hug the reading start, which is the right edge.
export const ar = (s) => s === 'Ar'
export const T = (s) => ar(s)
  ? { label: 'ArabicLabel', body: 'ArabicBody', small: 'ArabicCaption', title: 'ArabicTitle', amount: 'V2ArAmount', ui: 'ArabicLabel' }
  : { label: 'V2Label', body: 'Body', small: 'V2Small', title: 'Title', amount: 'Figure', ui: 'V2Label' }
export const ord = (s, list) => (ar(s) ? [...list].reverse() : list)
export const start = (s) => (ar(s) ? 'end' : 'start')
export const box = { radius: 'radius.media', fill: 'color.surface.page', stroke: LINE }

export function button(s, label, primary = true, arrowed = true) {
  const t = text(label, T(s).ui, { color: primary ? 'color.text.inverse' : 'color.text.primary', name: 'Label' })
  const arrow = icon(ar(s) ? 'back' : 'forward', primary ? 'color.text.inverse' : 'color.text.primary')
  return row(`Button ${s}${primary ? '' : ' secondary'}`, arrowed ? ord(s, [t, arrow]) : [t], {
    gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.group' }, radius: 'radius.pill',
    ...(primary ? { fill: 'color.surface.inverse' } : { fill: 'color.surface.page', stroke: LINE }),
  })
}

export function field(s, radius = 'radius.media') {
  return col(`Field ${s}`, [
    text(C.email[s], T(s).label, { name: 'Label' }),
    row('Input', [text('sam@dualkit.dev', 'Body', { name: 'Value' })], { w: 'fill', pad: { block: 'space.snug', inline: 'space.snug' }, ...box, radius }),
    text(C.help[s], T(s).small, { color: 'color.text.soft', w: 'fill', align: start(s), name: 'Help' }),
  ], { w: 'fill', gap: 'space.tight', align: start(s) })
}

export function digits(s, compact = false) {
  const cell = (d, k) => row(`Box ${k + 1}`, d ? [text(d, ar(s) ? 'ArabicTitle' : 'Title', { name: 'Digit' })] : [], {
    w: compact ? 32 : 40, h: compact ? 40 : 44, justify: 'center', align: 'center', radius: 'radius.media', fill: 'color.surface.page',
    stroke: k === 3 ? { color: 'color.text.primary', width: 2 } : LINE,
  })
  return col(`Digit input ${s}`, [
    text(C.code[s], T(s).label, { name: 'Label' }),
    row('Boxes', [...C.digits[s], null, null, null].map(cell), { gap: 'space.tight' }),
  ], { gap: 'space.tight', align: start(s) })
}

export function amount(s) {
  return col(`Amount ${s}`, [
    text(C.total[s], T(s).small, { color: 'color.text.soft', name: 'Label' }),
    text(C.aed[s], T(s).amount, { name: 'Value' }),
    text(C.vat[s], T(s).small, { color: 'color.text.faint', name: 'Note' }),
  ], { gap: 'space.hair', align: start(s) })
}

export function date(s) {
  const lines = col('Dates', [
    text(C.greg[s], T(s).body, { name: 'Gregorian' }),
    text(C.hijri[s], T(s).small, { color: 'color.text.soft', name: 'Hijri' }),
  ], { w: 'fill', align: start(s) })
  return row(`Date ${s}`, ord(s, [glyph('calendar', 'color.text.soft'), lines]), { w: 'fill', gap: 'space.snug', align: 'center', pad: { block: 'space.snug', inline: 'space.snug' }, ...box })
}

export function tabs(s) {
  const tab = (label, k) => col(`Tab ${k + 1}`, [
    row('Tab label', [text(label, T(s).ui, { color: k === 0 ? 'color.text.primary' : 'color.text.soft', name: 'Label' })], { pad: { block: 'space.snug', inline: 'space.snug' } }),
    { shape: 'Indicator', kind: 'rect', size: [1, 2], w: 'fill', h: 2, fill: k === 0 ? 'color.surface.inverse' : 'color.border.grid' },
  ])
  return row(`Tabs ${s}`, ord(s, C.tabs[s].map(tab)), {})
}

export function sheet(s) {
  const pair = ([k, v], i) => row(`Sheet row ${i + 1}`, ord(s, [text(k, T(s).small, { color: 'color.text.soft', name: 'Key' }), text(v, ar(s) && i === 0 ? 'ArabicBody' : 'V2Mono', { name: 'Value' })]), { w: 'fill', justify: 'between', align: 'center' })
  const close = row('Close', [glyph('close', 'color.text.soft')], { w: 28, h: 28, justify: 'center', align: 'center', radius: 'radius.pill', stroke: LINE })
  return col(`Sheet ${s}`, [
    row('Sheet head', ord(s, [text(C.sheet[s], T(s).title, { name: 'Title' }), close]), { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.item', inline: 'space.group' } }),
    hline('Sheet head rule'),
    col('Sheet rows', C.rows[s].map(pair), { w: 'fill', gap: 'space.snug', pad: { block: 'space.item', inline: 'space.group' } }),
    hline('Sheet foot rule'),
    row('Sheet actions', ord(s, [button(s, C.cancel[s], false, false), button(s, C.pay[s])]), { w: 'fill', gap: 'space.tight', justify: ar(s) ? 'start' : 'end', pad: { block: 'space.item', inline: 'space.group' } }),
  ], { w: 'fill', ...box })
}

export function toast(s, compact = false) {
  return row(`Toast ${s}`, ord(s, [
    icon('check', 'color.text.inverse'),
    text(C.toast[s], compact ? T(s).small : T(s).body, { color: 'color.text.inverse', w: 'fill', align: start(s), name: 'Message' }),
    text(C.undo[s], T(s).label, { color: 'color.text.inverse', name: 'Undo' }),
  ]), { w: 'fill', gap: 'space.snug', align: 'center', pad: { block: 'space.snug', inline: 'space.item' }, radius: 'radius.media', fill: 'color.surface.inverse' })
}

const BUILD = { Button: (s) => button(s, C.next[s]), Field: field, 'Digit input': (s) => digits(s, true), Amount: amount, Date: date, Tabs: tabs, Sheet: sheet, Toast: toast }

export const command = (w = 'hug') => row('Install command', [
  text(`$ ${STARTER.install}`, 'V2Mono', { name: 'Command' }),
  icon('copy', 'color.text.soft'),
], { w, gap: 'space.item', ...(w === 'fill' ? { justify: 'between' } : {}), align: 'center', pad: { block: 'space.snug', inline: 'space.item' }, ...box })

export function toggle(labels, active) {
  return row('Language toggle', labels.map((l, k) => row(`${k ? 'Arabic' : 'English'} option`, [text(l, k ? 'ArabicLabel' : 'V2Label', { color: k === active ? 'color.text.primary' : 'color.text.soft' })], {
    pad: { block: 'space.tight', inline: 'space.item' }, radius: 'radius.pill', ...(k === active ? { fill: 'color.surface.page', stroke: LINE } : {}),
  })), { pad: 'space.hair', radius: 'radius.pill', fill: 'color.surface.panel' })
}

// A: one specimen, a checkout made of the real components, flipped by a language toggle.
function specimenA(s, mobile = false) {
  const colA = col('Specimen start', [tabs(s), field(s), digits(s)], { w: 'fill', gap: 'space.block', align: start(s) })
  const colB = col('Specimen middle', [amount(s), date(s), row('Buttons', ord(s, [button(s, C.more[s], false), button(s, C.next[s])]), { gap: 'space.tight' })], { w: 'fill', gap: 'space.block', align: start(s) })
  const colC = col('Specimen end', [sheet(s)], { w: 'fill' })
  if (mobile) return col('Specimen', [colA, colB, colC, toast(s, true)], { w: 'fill', gap: 'space.block', pad: 'space.group', radius: 'radius.media', fill: 'color.surface.raised', stroke: LINE })
  const cols = row('Specimen columns', ord(s, [colA, vline('Specimen rule 1'), colB, vline('Specimen rule 2'), colC]), { w: 'fill', gap: 'space.card' })
  const foot = row('Specimen foot', [row('Toast slot', [toast(s)], { w: 'size.v2.cli.w' })], { w: 'fill', justify: ar(s) ? 'end' : 'start' })
  return col('Specimen', [cols, hline('Specimen foot rule'), foot], { w: 'fill', gap: 'space.card', pad: 'space.card', radius: 'radius.media', fill: 'color.surface.raised', stroke: LINE })
}

function sectionA(mobile = false) {
  const p = STARTER.a
  const copy = col('Starter copy', [text(p.heading, 'V2H2', { name: 'Heading', ...(mobile ? { w: 'fill' } : {}) }), text(p.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })], { w: mobile ? 'fill' : 'size.v2.half', gap: 'space.group' })
  const controls = col('Starter controls', [toggle(p.toggle, 1), command(mobile ? 'fill' : 'hug')], { gap: 'space.item', align: mobile ? 'start' : 'end', ...(mobile ? { w: 'fill' } : {}) })
  const head = mobile ? col('Starter header', [copy, controls], { w: 'fill', gap: 'space.block' }) : row('Starter header', [copy, controls], { w: 'fill', justify: 'between', align: 'end' })
  return [head, specimenA('Ar', mobile)]
}

// B: a wall of eight cells, each split down the middle into English and Arabic.
function cellB([name, why], k, mobile) {
  const inner = (s) => (name === 'Sheet' && !mobile ? col(`${name} ${s} frame`, [BUILD[name](s)], { w: 'size.v2.cli.w' }) : BUILD[name](s))
  const side = (s) => col(`${name} ${s}`, [inner(s)], { w: 'fill', ...(mobile ? {} : { h: 'fill' }), justify: 'center', align: ar(s) ? 'end' : 'start', pad: name === 'Sheet' && !mobile ? 'space.block' : 'space.item' })
  const handle = col('Split', [vline('Split line')], { w: 'size.stroke', h: 'fill' })
  return col(`${name} cell`, [
    mobile
      ? col(`${name} split`, [side('En'), hline(`${name} split line`), side('Ar')], { w: 'fill' })
      : row(`${name} split`, [side('En'), handle, side('Ar')], { w: 'fill', h: name === 'Sheet' ? 300 : name === 'Toast' ? 120 : 200 }),
    hline(`${name} cell rule`),
    col(`${name} caption`, [text(name, 'V2Label', { name: 'Name' }), text(why, 'V2Small', { color: 'color.text.soft', w: 'fill', name: 'Why' })], { w: 'fill', gap: 'space.hair', pad: { block: 'space.item', inline: 'space.item' } }),
  ], { w: 'fill' })
}

function wallB(mobile = false) {
  const cells = STARTER.components.map((c, k) => cellB(c, k, mobile))
  if (mobile) return col('Wall', cells.flatMap((c, k) => [...(k ? [hline(`Wall rule ${k}`)] : []), c]), { w: 'fill', ...box })
  // Sheet and toast are wide, so they take a full row each; the rest run two to a row.
  const rows = [0, 2, 4].map((i) => row(`Wall row ${i / 2 + 1}`, [cells[i], vline(`Wall column rule ${i / 2 + 1}`), cells[i + 1]], { w: 'fill' })).concat([row('Wall row 4', [cells[6]], { w: 'fill' }), row('Wall row 5', [cells[7]], { w: 'fill' })])
  return col('Wall', rows.flatMap((r, k) => [...(k ? [hline(`Wall row rule ${k}`)] : []), r]), { w: 'fill', ...box })
}

function sectionB(mobile = false) {
  const p = STARTER.b
  const heading = text(p.heading, 'V2H2', { name: 'Heading', ...(mobile ? { w: 'fill' } : {}) })
  const side = col('Starter side', [text(p.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }), command('fill'), text(p.copyIn, 'V2Small', { color: 'color.text.soft', name: 'Copy in' })],
    { w: mobile ? 'fill' : 'size.v2.cli.w', gap: 'space.item' })
  const head = mobile ? col('Starter header', [heading, side], { w: 'fill', gap: 'space.group' }) : row('Starter header', [heading, side], { w: 'fill', justify: 'between', align: 'end' })
  return [head, wallB(mobile)]
}

// C: the pipeline, a token value you can press, and the result in both languages.
function paneC(title, body, extra = {}) {
  return col(`${title} pane`, [
    row(`${title} head`, [text(title, 'V2Mono', { color: 'color.text.faint', name: 'Pane title' })], { w: 'fill', pad: { block: 'space.tight', inline: 'space.snug' } }),
    hline(`${title} rule`),
    body,
  ], { w: 'fill', ...box, clip: true, ...extra })
}

function tokensPane(mobile) {
  const p = STARTER.c
  const line = (t, hot, k) => row(`Code row ${k + 1}`, [text(t, 'V2Mono', { name: 'Code text' })], { w: 'fill', pad: { block: 2, inline: 'space.tight' }, ...(hot ? { fill: 'color.surface.highlight' } : {}) })
  const code = col('Tokens', ['{', '  "radius": {', `    "control": ${p.values[p.active]}`, '  },', '  "script": {', '    "ar": { "body": 17 }', '  }', '}'].map((t, k) => line(t, k === 2, k)), { w: 'fill', gap: 2, pad: 'space.tight' })
  const chip = (v, k) => row(`Value ${v}`, [text(v, 'V2Mono', { color: k === p.active ? 'color.text.inverse' : 'color.text.primary' })], {
    pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', ...(k === p.active ? { fill: 'color.surface.inverse' } : { stroke: LINE }),
  })
  const chips = row('Values', [text('radius.control', 'V2Small', { color: 'color.text.soft' }), ...p.values.map(chip)], { w: 'fill', gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.snug' } })
  return paneC('tokens.json', col('Tokens body', [code, hline('Values rule'), chips], { w: 'fill' }), mobile ? {} : { h: 'fill' })
}

function figmaPane(mobile) {
  const head = row('Variables head', [text('Variable', 'V2Small', { color: 'color.text.faint', w: 'fill' }), text('en', 'V2Small', { color: 'color.text.faint', w: 64 }), text('ar', 'V2Small', { color: 'color.text.faint', w: 64 })], { w: 'fill', pad: { block: 'space.tight', inline: 'space.snug' } })
  const v = (name, en, arv, hot) => row(name, [text(name, 'V2Mono', { w: 'fill' }), text(en, 'V2Mono', { w: 64 }), text(arv, 'V2Mono', { w: 64 })],
    { w: 'fill', pad: { block: 'space.tight', inline: 'space.snug' }, ...(hot ? { fill: 'color.surface.highlight' } : {}) })
  const rows = [v('radius/control', '12', '12', true), v('type/body/size', '16', '17'), v('type/body/leading', '24', '28'), v('type/body/family', 'Switzer', 'Plex'), v('color/surface/inverse', 'ink', 'ink')]
  return paneC('Figma variables', col('Variables', [head, hline('Variables head rule'), ...rows], { w: 'fill' }), mobile ? {} : { h: 'fill' })
}

function appPane(mobile) {
  const r = (s) => col(`App ${s}`, [field(s, 'radius.control'), button(s, C.next[s])], { w: 'fill', gap: 'space.item', align: start(s), pad: 'space.item' })
  const body = mobile ? col('App', [r('En'), hline('App rule'), r('Ar')], { w: 'fill' }) : row('App', [r('En'), vline('App rule'), r('Ar')], { w: 'fill', h: 'fill' })
  return paneC('Your app', body, mobile ? {} : { h: 'fill' })
}

function sectionC(mobile = false) {
  const p = STARTER.c
  const copy = col('Starter copy', [text(p.heading, 'V2H2', { name: 'Heading', ...(mobile ? { w: 'fill' } : {}) }), text(p.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })], { w: mobile ? 'fill' : 'size.v2.half', gap: 'space.group' })
  const head = mobile ? col('Starter header', [copy, command('fill')], { w: 'fill', gap: 'space.block' }) : row('Starter header', [copy, command()], { w: 'fill', justify: 'between', align: 'end' })
  const panes = mobile
    ? col('Pipeline', [tokensPane(true), figmaPane(true), appPane(true)], { w: 'fill', gap: 'space.snug' })
    : row('Pipeline', [tokensPane(false), figmaPane(false), appPane(false)], { w: 'fill', h: 'size.v2.pipe', gap: 'space.snug' })
  return [head, panes]
}

const DESKTOP = 'size.desktop'
const SECTIONS = { a: sectionA, b: sectionB, c: sectionC }
const NAMES = { a: 'A', b: 'B', c: 'C' }

export function desktop(key) {
  const p = V2.parts
  return {
    screen: `Dualkit · Starter section · ${NAMES[key]} · Desktop`,
    size: [DESKTOP, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [formatSection(p[1], formatTile()), band('Starter', SECTIONS[key](false), { gap: 'space.v2.inner', pad: { top: 'space.v2.section' } }), mirror()],
  }
}

export function mobile(key) {
  return {
    screen: `Dualkit · Starter section · ${NAMES[key]} · Mobile`,
    size: [390, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    pad: { block: 120, inline: 'space.item' }, gap: 'space.stack',
    children: SECTIONS[key](true),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
mkdirSync(SPECS, { recursive: true })
for (const key of Object.keys(SECTIONS)) {
  writeFileSync(resolve(SPECS, `starter-section-${key}-desktop.json`), JSON.stringify(desktop(key), null, 2) + '\n')
  writeFileSync(resolve(SPECS, `starter-section-${key}-mobile.json`), JSON.stringify(mobile(key), null, 2) + '\n')
}
console.log('specs written')
}
