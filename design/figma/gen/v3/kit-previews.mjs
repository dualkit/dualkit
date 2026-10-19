// The kit's four undrawn previews (Format, Starter, Check, Bench), each a glass panel on the painting at the size of the
// kit frame's right-hand pane. Skills is already drawn on the home frame.
// Run: node gen/v3/kit-previews.mjs, which writes specs/kit-previews-v3.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { V3 } from './copy.mjs'
import { benchTrack, makerSvgFor } from './home.mjs'
import { MENU } from './menu.mjs'
import { GLASS_LINE, col, glass, gsoft, gtext, hline, icon, label, meter, painting, row, square, text } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const PANE_H = 560

// The phone input carries a left-to-right mark after each group: without it the bidi algorithm reverses
// space-separated Arabic-Indic digit groups even in a left-to-right line, which is the bug Dualkit fixes.
export const KIT = {
  format: {
    package: '@dualkit/format', install: 'npm i @dualkit/format',
    lines: [['Money', '١٬٢٣٤٫٥٠ د.إ', '1234.50 AED'], ['Hijri date', '١ رمضان ١٤٤٧', '2026-02-18'], ['Phone', '٠٥٠\u200e ١٢٣\u200e ٤٥٦٧', '+971 50 123 4567']],
  },
  starter: {
    components: ['Amount', 'Button', 'DateDisplay', 'DigitInput', 'Field', 'Sheet', 'Tabs', 'Toast'],
    amount: ['AED 1,234.50', '١٬٢٣٤٫٥٠ د.إ'],
  },
  check: { families: [['Bidi', 4], ['Layout', 4], ['Icons', 2], ['Type', 5], ['Content', 5]] },
}

const status = (word) => row(word, [square(`${word} square`, 6, 'color.signal.dot'), gsoft(word)], { gap: 'space.tight', align: 'center' })
const head = (name, start, end) => row(`${name} head`, [start, end], { w: 'fill', justify: 'between', align: 'center', pad: { bottom: 'space.snug' } })
const ruled = (name, children) => col(`${name} line`, [hline(`${name} rule`, 'color.v3.glassLine'), ...children], { w: 'fill' })

function formatPanel() {
  const f = KIT.format
  const line = ([what, input, output]) => ruled(what, [col(`${what} parse`, [
    gsoft(what, 'V3Small', { name: 'What' }),
    row(`${what} row`, [
      text(input, 'V2ArBody', { color: 'color.v3.glassText', name: 'Typed' }),
      row(`${what} result`, [icon('arrow', 'color.v3.glassSoft', 14), text(output, 'V3Mono', { color: 'color.v3.glassText', name: 'Parsed' })], { gap: 'space.snug', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center' }),
  ], { w: 'fill', gap: 'space.hair', pad: { block: 'space.snug' } })])
  return glass('Format panel', [
    head('Format', status('Parsed'), text(f.package, 'V3Mono', { color: 'color.v3.glassText' })),
    ...f.lines.map(line),
    row('Format install', [text('$', 'V3Mono', { color: 'color.v3.glassSoft' }), text(f.install, 'V3Mono', { color: 'color.v3.glassText', w: 'fill' }), icon('copy', 'color.v3.glassSoft', 14)],
      { w: 'fill', gap: 'space.snug', align: 'center', pad: 'space.snug', stroke: GLASS_LINE }),
  ], { w: 380, gap: 'space.snug', pad: 'space.item' })
}

function starterPanel() {
  const s = KIT.starter
  const cell = (name) => glass(`${name} cell`, [
    text(name, 'V3Mono', { color: 'color.v3.glassText', name: 'Component' }),
    ...(name === 'Amount' ? [col('Amount both', [
      gtext(s.amount[0], 'V3Glass', { name: 'English' }),
      text(s.amount[1], 'V2ArBody', { color: 'color.v3.glassText', name: 'Arabic' }),
    ], { w: 'fill', gap: 'space.hair' })] : []),
  ], { w: 'fill', h: 'fill', gap: 'space.tight', pad: 'space.item' })
  return col('Starter grid', [{ stack: 'Starter cells', dir: 'grid', columns: 2, gap: 'space.tight', w: 'fill', children: s.components.map(cell) }], { w: 400 })
}

function checkPanel() {
  const fam = ([name, n]) => row(`${name} family`, [
    gtext(name, 'V3Glass', { w: 72, name: 'Family' }),
    meter(`${name} bar`, 1, 220),
    gsoft(`${n} of ${n}`, 'V3Small', { name: 'Count' }),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.tight' } })
  return glass('Check panel', [
    head('Check', row('Check title', [row('Check square', [icon('check', 'color.text.primary', 12)], { w: 18, h: 18, justify: 'center', align: 'center', fill: 'color.v3.glassButton' }), gtext('dualkit check')], { gap: 'space.snug', align: 'center' }),
      row('Score', [square('Score square', 6, 'color.signal.dot'), gsoft('20 of 20')], { gap: 'space.tight', align: 'center' })),
    col('Families', KIT.check.families.map(fam), { w: 'fill' }),
    row('Check actions', [row('Open report', [icon('check', 'color.text.primary', 12), text('Open report', 'V3Glass')], { w: 'fill', gap: 'space.tight', justify: 'center', align: 'center', pad: { block: 'space.tight' }, fill: 'color.v3.glassButton' }),
      row('Copy', [gtext('Copy')], { pad: { block: 'space.tight', inline: 'space.snug' }, stroke: GLASS_LINE })], { w: 'fill', gap: 'space.tight' }),
  ], { w: 400, gap: 'space.item', pad: 'space.group' })
}

function benchPanel() {
  const TRACK = 348
  const r = ([name, m, a, d]) => ruled(name, [col(`${name} entry`, [
    row(`${name} head`, [
      row(`${name} name`, [{ shape: `${name} maker`, kind: 'svg', size: [14, 14], svg: makerSvgFor(m), tint: 'color.v3.glassText' }, gtext(name, 'V3Glass')], { gap: 'space.tight', align: 'center' }),
      row(`${name} figures`, [gsoft(`${a}`), gtext(`${d}`, 'V3Glass'), text(`+${d - a}`, 'V3Mono', { color: 'color.v3.glassText' })], { gap: 'space.snug', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center' }),
    benchTrack(a, d, TRACK, 'color.v3.glassText', 'color.v3.glassLine', 'color.v3.glass'),
  ], { w: 'fill', gap: 'space.snug', pad: { block: 'space.snug' } })])
  return glass('Bench panel', [
    head('Bench', gtext('Alone, then with Dualkit'), gsoft('Sample data until 1 November')),
    ...V3.bench.rows.slice(0, 3).map(r),
  ], { w: 380, gap: 'space.hair', pad: 'space.item' })
}

function preview(k, panelNode) {
  const [no, name, line] = MENU.parts[k]
  return col(`${name} preview`, [
    painting(`${name} painting`, [panelNode], { h: PANE_H }),
    row(`${name} caption`, [row(`${name} caption start`, [text(no, 'V3Small', { color: 'color.text.faint' }), text(name, 'V3Step')], { gap: 'space.item', align: 'center' }),
      text(line, 'V3Small', { color: 'color.text.soft' })], { w: 'fill', justify: 'between', align: 'center' }),
  ], { w: 'fill', h: 'fill', gap: 'space.item' })
}

export function kitPreviews() {
  return {
    screen: 'Dualkit · Kit previews · v3',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary', pad: 'space.v2.inner', gap: 'space.stack',
    children: [
      col('Previews title', [label('The kit'), text('What each part shows when it opens.', 'V3H2', { name: 'Heading' })], { gap: 'space.group' }),
      { stack: 'Previews', dir: 'grid', columns: 2, gap: 'space.card', w: 'fill', children: [
        preview(1, formatPanel()), preview(2, starterPanel()), preview(3, checkPanel()), preview(4, benchPanel()),
      ] },
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'kit-previews-v3.json'), JSON.stringify(kitPreviews(), null, 2))
  console.log('wrote specs/kit-previews-v3.json')
}
