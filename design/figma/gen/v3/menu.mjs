// The Products menu, open: five parts on the left, a live preview of the one under the pointer with its install line, and where to start on the right.
// Run: node gen/v3/menu.mjs, which writes specs/menu-v3-desktop.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { band, col, frame, glass, gsoft, gtext, hline, icon, meter, painting, row, square, text, vline } from './parts.mjs'
import { hero, nav } from './home.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export const MENU = {
  parts: [
    ['01', 'Skills', 'Teach Claude Code and Cursor to build right to left', '4 skills'],
    ['02', 'Format', 'Money, dates, phones and IBANs from the digits people type', 'npm'],
    ['03', 'Starter', 'Eight bilingual components to copy into your app', 'shadcn'],
    ['04', 'Check', 'Score any page against 20 Arabic rules', 'CLI'],
    ['05', 'Bench', 'How free AI models build Arabic, every month', 'Monthly'],
  ],
  command: '/plugin install dualkit@dualkit',
  start: ['Quick start', 'Docs', 'Updates', 'Status'],
  latest: ['Latest', 'dualkit check, beta', '18 Oct'],
  bench: ['The Bench', 'Next run in 12 days'],
  keys: [['↑ ↓', 'move'], ['Enter', 'open'], ['Esc', 'close']],
}

function partRow([no, name, line, tag], k) {
  const on = k === 0
  return row(`${name} entry`, [
    row(`${name} start`, [text(no, 'V3Small', { color: 'color.text.faint', name: 'Number' }),
      col(`${name} words`, [text(name, 'V3Step', { name: 'Name' }), text(line, 'V3Small', { color: 'color.text.soft', w: 'fill', name: 'Line' })], { w: 'fill', gap: 'space.hair' })],
    { w: 'fill', gap: 'space.item', align: 'start' }),
    row(`${name} tag`, [text(tag, 'V3Small', { color: on ? 'color.text.primary' : 'color.text.faint' })], { pad: { inline: 'space.tight' }, stroke: { color: 'color.v3.line', width: 'size.stroke' } }),
  ], { w: 'fill', gap: 'space.item', align: 'start', pad: { block: 'space.item', inline: 'space.item' }, ...(on ? { fill: 'color.surface.highlight' } : {}) })
}

function preview() {
  const r = (k, name, when, on) => row(`Skill ${k}`, [
    row(`Skill ${k} start`, [gsoft(String(k)), text(name, 'V3Mono', { color: 'color.v3.glassText' })], { gap: 'space.snug', align: 'center' }),
    gsoft(when),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.tight', inline: 'space.snug' }, ...(on ? { fill: 'color.v3.glassLine' } : {}) })
  const panel = glass('Skills preview panel', [
    row('Preview head', [gtext('Loads when a task needs it'), row('Ready', [square('Ready square', 6, 'color.signal.dot'), gsoft('ready')], { gap: 'space.tight', align: 'center' })], { w: 'fill', justify: 'between', align: 'center', pad: { bottom: 'space.tight' } }),
    r(1, 'rtl-layout', 'on dir="rtl"', true), r(2, 'gulf-formats', 'on money, dates'), r(3, 'type-pairing', 'on Arabic type'), r(4, 'bilingual-copy', 'on copy'),
  ], { w: 340, gap: 'space.hair', pad: 'space.snug' })
  const command = row('Install line', [text('$', 'V3Mono', { color: 'color.text.faint' }), text(MENU.command, 'V3Mono', { w: 'fill' }), icon('copy', 'color.text.soft', 14)],
    { w: 'fill', gap: 'space.snug', align: 'center', pad: { block: 'space.snug', inline: 'space.item' }, stroke: { color: 'color.v3.line', width: 'size.stroke' } })
  return col('Preview', [
    painting('Preview painting', [panel], { h: 260 }),
    command,
    row('Preview links', [row('Open docs', [text('Open the Skills docs', 'V3Label'), icon('arrow', 'color.text.primary', 14)], { gap: 'space.tight', align: 'center' }),
      text('Listed in the Claude plugin directory', 'V3Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between', align: 'center' }),
  ], { w: 'fill', gap: 'space.item', pad: 'space.card' })
}

function side() {
  const m = MENU
  return col('Side', [
    col('Start here', [text('Start here', 'V3Small', { color: 'color.text.faint' }), ...m.start.map((s) => text(s, 'V3Label', { name: s }))], { w: 'fill', gap: 'space.snug' }),
    hline('Side rule 1'),
    col('Latest', [text(m.latest[0], 'V3Small', { color: 'color.text.faint' }), text(m.latest[1], 'V3Label'), text(m.latest[2], 'V3Small', { color: 'color.text.soft' })], { w: 'fill', gap: 'space.hair' }),
    hline('Side rule 2'),
    col('Bench status', [text(m.bench[0], 'V3Small', { color: 'color.text.faint' }), row('Countdown', [square('Countdown square', 6), text(m.bench[1], 'V3Label')], { gap: 'space.tight', align: 'center' })], { w: 'fill', gap: 'space.hair' }),
  ], { w: 240, gap: 'space.item', pad: 'space.card' })
}

function keys() {
  return row('Keys', MENU.keys.map(([k, what]) => row(`${what} key`, [row(`${what} keycap`, [text(k, 'V3Mono')], { pad: { inline: 'space.tight' }, stroke: { color: 'color.v3.line', width: 'size.stroke' } }), text(what, 'V3Small', { color: 'color.text.faint' })], { gap: 'space.tight', align: 'center' })),
    { w: 'fill', gap: 'space.card', align: 'center', pad: { block: 'space.snug', inline: 'space.item' } })
}

export function menuV3() {
  const list = col('Parts', MENU.parts.flatMap((p, k) => [...(k ? [hline(`Parts rule ${k}`)] : []), partRow(p, k)]), { w: 440 })
  const drawer = band('Menu', [
    frame('Menu frame', [
      row('Menu columns', [list, vline('Menu split 1'), preview(), vline('Menu split 2'), side()], { w: 'fill' }),
      hline('Menu keys rule'),
      keys(),
    ], { dir: 'col', joins: [440, 1200 - 240], fill: 'color.v3.ground' }),
  ], { pad: { top: 'space.item' } })
  return {
    screen: 'Dualkit · Menu open · Desktop · v3',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary',
    children: [nav('Products'), drawer, col('Page behind', [hero()], { w: 'fill', opacity: 0.25 })],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'menu-v3-desktop.json'), JSON.stringify(menuV3(), null, 2))
  console.log('wrote specs/menu-v3-desktop.json')
}
