// Three hero graphic directions, each complex and specific to Dualkit, for Sam to pick from.
// A Mirror axis, B Redline, C Formats wall. Run: node gen/v3/hero-options.mjs, which writes specs/hero-options-v3.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GLASS_LINE, col, glass, gsoft, gtext, icon, painting, row, square, text } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const ROW = 48
const W = 'color.v3.glassText'
const ar = (t, style = 'V2ArBody', extra = {}) => text(t, style, { color: W, align: 'end', ...extra })
const mono = (t, extra = {}) => text(t, 'V3Mono', { color: W, ...extra })
const hl = (name, w = 'fill', fill = 'color.v3.glassLine') => (typeof w === 'number' ? { shape: name, kind: 'rect', size: [w, 1], fill } : { shape: name, kind: 'rect', size: [1, 1], w, h: 1, fill })
const vl = (name, fill = 'color.v3.glassLine') => ({ shape: name, kind: 'rect', size: [1, 1], w: 1, h: 'fill', fill })

// A · Mirror axis: the same screen in both directions, joined across a ruled axis that says what mirrors and what does not.
function mirrorPanel(rtl) {
  const cell = (name, k, v, extra = {}) => row(`${name} row`, rtl ? [ar(v, 'V2ArBody', { name: 'Value' }), ar(k, 'V2ArBody', { color: 'color.v3.glassSoft', name: 'Key' })] : [gsoft(k, 'V3Small', { name: 'Key' }), gtext(v, 'V3Glass', { name: 'Value' })],
    { w: 'fill', h: ROW, justify: 'between', align: 'center', pad: { inline: 'space.item' }, ...extra })
  const arrow = icon(rtl ? 'back' : 'forward', 'color.text.primary', 14)
  const pay = row('Pay row', [row('Pay', rtl ? [arrow, text('إتمام الدفع', 'V2ArBody', { color: 'color.text.primary' })] : [text('Pay now', 'V3Glass'), arrow], { w: 'fill', h: 36, gap: 'space.tight', justify: 'center', align: 'center', fill: 'color.v3.glassButton' })],
    { w: 'fill', h: ROW + 12, align: 'center', pad: { inline: 'space.item' } })
  return glass(rtl ? 'Arabic panel' : 'English panel', [
    row('Head', rtl ? [gsoft('rtl'), ar('ملخص الدفع', 'V2ArTitle')] : [gtext('Payment summary'), gsoft('ltr')], { w: 'fill', h: ROW, justify: 'between', align: 'center', pad: { inline: 'space.item' } }),
    rtl ? cell('Amount', 'المبلغ', '1,234.50 د.إ') : cell('Amount', 'Amount due', 'AED 1,234.50'),
    rtl ? cell('Date', 'الاستحقاق', '1 رمضان 1447 هـ') : cell('Date', 'Due', '1 Ramadan 1447 AH'),
    rtl ? cell('Phone', 'الجوال', '+971 50 123 4567', { fill: 'color.v3.glassLine' }) : cell('Phone', 'Mobile', '+971 50 123 4567', { fill: 'color.v3.glassLine' }),
    pay,
  ], { w: 320 })
}

function axis() {
  const tag = (t, strong) => row(`${t} tag`, [text(t, 'V3Small', { color: strong ? 'color.text.primary' : W })], { pad: { inline: 'space.tight', block: 'space.hair' }, ...(strong ? { fill: 'color.v3.glassButton' } : { fill: '#3a2a20', stroke: GLASS_LINE }) })
  const link = (name, t, strong) => row(`${name} link`, [hl(`${name} wire start`, 'fill', strong ? W : 'color.v3.glassLine'), tag(t, strong), hl(`${name} wire end`, 'fill', strong ? W : 'color.v3.glassLine')], { w: 'fill', h: ROW, align: 'center' })
  const H = ROW * 4 + 12
  const ruler = col('Ruler', Array.from({ length: 22 }, (_, k) => ({ shape: `Ruler tick ${k + 1}`, kind: 'rect', size: [k % 3 === 0 ? 12 : 6, 1], fill: W })), { w: 12, h: H, justify: 'between', align: 'center', abs: { start: 139, top: 0 } })
  return col('Axis', [
    { shape: 'Axis line', kind: 'rect', size: [1, H], fill: W, abs: { start: 145, top: 0 } },
    ruler,
    row('Axis head', [tag('dir flips here')], { w: 'fill', h: ROW, justify: 'center', align: 'center' }),
    link('Amount', 'amount mirrors'), link('Date', 'Hijri, both ways'), link('Phone', 'phone stays left to right', true),
    row('Pay link', [hl('Pay wire start'), tag('arrow flips'), hl('Pay wire end')], { w: 'fill', h: ROW + 12, align: 'center' }),
  ], { w: 290 })
}

export function heroMirror(h = 560) {
  return painting('A · Mirror axis painting', [row('Mirror', [mirrorPanel(false), axis(), mirrorPanel(true)], { align: 'center' })], { h })
}

// B · Redline: one Arabic screen in glass, annotated like a spec, every callout a rule Dualkit applies.
function phone() {
  const r = (k, v, extra = {}) => row(`${k} row`, [ar(v), ar(k, 'V2ArBody', { color: 'color.v3.glassSoft' })], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug' }, ...extra })
  return glass('Screen', [
    row('Screen bar', [gsoft('9:41'), row('Screen dots', [square('Bar 1', 4, W), square('Bar 2', 4, W), square('Bar 3', 4, W)], { gap: 'space.hair' })], { w: 'fill', justify: 'between', align: 'center' }),
    ar('ملخص الدفع', 'V2ArTitle', { w: 'fill' }),
    col('Amount block', [ar('المبلغ المستحق', 'V2ArBody', { color: 'color.v3.glassSoft' }), ar('1,234.50 د.إ', 'V2ArAmount')], { w: 'fill', align: 'end' }),
    hl('Screen rule 1'), r('الاستحقاق', '1 رمضان 1447 هـ'), hl('Screen rule 2'),
    r('الجوال', '+971 50 123 4567', { stroke: { color: W, width: 'size.stroke', dash: [3, 2] }, pad: { block: 'space.snug', inline: 'space.tight' } }),
    hl('Screen rule 3'), r('الآيبان', 'AE07 0331 2345 6789 0123 456'),
    row('Screen pay', [text('إتمام الدفع', 'V2ArBody', { color: 'color.text.primary' })], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, fill: 'color.v3.glassButton' }),
  ], { w: 320, gap: 'space.snug', pad: 'space.item' })
}

function callouts(side, items) {
  const c = ([no, rule, value]) => row(`${rule} callout`, [
    ...(side === 'end' ? [hl(`${rule} leader`, 40, W)] : []),
    glass(`${rule} note`, [row(`${rule} head`, [row(`${rule} no`, [text(no, 'V3Small', { color: 'color.text.primary' })], { w: 18, h: 18, justify: 'center', align: 'center', fill: 'color.v3.glassButton' }), gtext(rule, 'V3Glass')], { gap: 'space.snug', align: 'center' }), mono(value, { color: 'color.v3.glassSoft' })],
      { w: 230, gap: 'space.hair', pad: 'space.snug' }),
    ...(side === 'start' ? [hl(`${rule} leader`, 40, W)] : []),
  ], { align: 'center' })
  return col(`${side} callouts`, items.map(c), { h: 'fill', justify: 'between', pad: { block: 'space.card' } })
}

export function heroRedline(h = 560) {
  const left = [['1', 'Direction', 'dir="rtl" lang="ar"'], ['2', 'Logical spacing', 'padding-inline-start: 24px'], ['3', 'Bidi isolation', '<bdi>+971 50 123 4567</bdi>']]
  const right = [['4', 'Arabic type', 'Plex Sans Arabic 16/1.7'], ['5', 'Hijri date', 'Umm al-Qura, Asia/Dubai'], ['6', 'IBAN', 'AE, 23 characters, valid']]
  return painting('B · Redline painting', [row('Redline', [callouts('start', left), phone(), callouts('end', right)], { h: 'fill', align: 'center' })], { h, pad: { block: 'space.card' } })
}

// C · Formats wall: six Gulf formats typed the way people type them, each parsed underneath.
const FORMATS = [
  ['Amount', '١٬٢٣٤٫٥٠ د.إ', 'parseAmount', '1234.50 AED'],
  ['Hijri date', '١ رمضان ١٤٤٧', 'toGregorian', '2026-02-18'],
  ['UAE phone', '٠٥٠ ١٢٣ ٤٥٦٧', 'parsePhone', '+971 50 123 4567'],
  ['Saudi riyal', '٩٩٫٩٩ ر.س', 'parseAmount', '99.99 SAR'],
  ['IBAN', 'AE07 0331 2345 6789 0123 456', 'validateIban', 'valid, UAE'],
  ['Dinar', '١٢٫٣٤٥ د.ك', 'parseAmount', '12.345 KWD'],
]
function formatTile([name, input, fn, out], k) {
  const lit = k === 2
  return glass(`${name} tile`, [
    row(`${name} head`, [gsoft(name), square(`${name} state`, 6, lit ? 'color.signal.dot' : W)], { w: 'fill', justify: 'between', align: 'center' }),
    ar(input, name === 'IBAN' ? 'V3Step' : 'V2ArAmount', { w: 'fill', name: 'Input' }),
    row(`${name} parse`, [hl(`${name} rule`, 'fill', W), mono(`${fn}()`, { color: 'color.v3.glassSoft' })], { w: 'fill', gap: 'space.snug', align: 'center' }),
    row(`${name} out`, [mono(out, { name: 'Output' })], { w: 'fill', ...(lit ? { fill: 'color.v3.glassLine' } : {}), pad: { inline: lit ? 'space.tight' : 'space.none' } }),
  ], { w: 'fill', h: 'fill', gap: 'space.snug', justify: 'between', pad: 'space.item', ...(lit ? { stroke: { color: W, width: 'size.stroke' } } : {}) })
}

export function heroFormats(h = 560) {
  return painting('C · Formats wall painting', [{ stack: 'Wall', dir: 'grid', columns: 3, gap: 'space.item', children: FORMATS.map(formatTile), w: 960 }], { h })
}

export function heroOptions() {
  const opt = (graphic, title, note) => col(`${title} option`, [graphic, col(`${title} caption`, [text(title, 'V3Step'), text(note, 'V3Small', { color: 'color.text.soft', w: 'fill' })], { w: 'fill', gap: 'space.tight' })], { w: 1120, gap: 'space.item' })
  return {
    screen: 'Dualkit · Hero graphic options · v3',
    size: [1200, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary', pad: 'space.card', gap: 'space.v2.tile',
    children: [
      text('Hero graphic: pick one', 'V3H2'),
      opt(heroMirror(), 'A · Mirror axis', 'The same payment screen in English and Arabic, joined across a ruled axis. Motion: rows build on both sides at once, pulses cross the axis row by row, and each tag says what happened: the amount mirrors, the Hijri date reads both ways, the phone stays left to right, the arrow flips.'),
      opt(heroRedline(), 'B · Redline', 'One Arabic screen annotated like a spec. Motion: the screen builds, then six numbered callouts draw their leaders in turn and type their values, each one a rule Dualkit applies (direction, logical spacing, bidi, Arabic type, Hijri, IBAN).'),
      opt(heroFormats(), 'C · Formats wall', 'Six Gulf formats typed the way people type them, with Arabic digits. Motion: a light sweeps the wall diagonally (the measured tile wave), and as it passes each tile its parser runs and the Latin result flips in underneath.'),
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'hero-options-v3.json'), JSON.stringify(heroOptions(), null, 2))
  console.log('wrote specs/hero-options-v3.json')
}
