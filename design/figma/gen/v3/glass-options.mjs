// Four glass treatments on the same panel and painting, for Sam to pick one. Raw values on purpose: the winner becomes tokens.
// Run: node gen/v3/glass-options.mjs, which writes specs/glass-options-v3.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { col, hline, painting, row, square, text } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const lin = (angle, stops) => ({ type: 'linear', angle, stops })

export const GLASS = {
  A: { name: 'A · Smoked (current)', note: 'Dark tint, 24px blur, flat 14% ring.',
    panel: { fill: '#0b0a0975', blur: 24, stroke: { color: '#ffffff24', width: 1 } }, fg: '#ffffff', soft: '#ffffffa3', chip: '#ffffff24' },
  B: { name: 'B · Frost', note: 'Milky white glass, 40px blur, ink text, a bright top edge.',
    panel: { fill: lin(90, [[0, '#ffffff8c'], [1, '#ffffff4d']]), blur: 40, stroke: { color: lin(90, [[0, '#ffffffe6'], [1, '#ffffff40']]), width: 1 } },
    fg: '#09090b', soft: '#09090b99', chip: '#ffffff99' },
  C: { name: 'C · Liquid edge', note: 'Deep tint, 32px blur, a light catching the top left edge and a 1px inner highlight.',
    panel: { fill: lin(90, [[0, '#1c120c66'], [1, '#0b0a09a6']]), blur: 32, stroke: { color: lin(45, [[0, '#fffffff2'], [0.35, '#ffffff1a'], [1, '#ffffff59']]), width: 1 },
      innerShadow: [{ x: 0, y: 1, blur: 0, color: '#ffffff59' }] }, fg: '#ffffff', soft: '#ffffffb3', chip: '#ffffff1f' },
  D: { name: 'D · Clear', note: 'Almost no tint, 16px blur, the painting reads through; text needs the bright ring.',
    panel: { fill: '#ffffff14', blur: 16, stroke: { color: '#ffffff59', width: 1 } }, fg: '#ffffff', soft: '#ffffffcc', chip: '#ffffff26' },
}

function panel(g) {
  const t = (c, style, color = g.fg, extra = {}) => text(c, style, { color, ...extra })
  const step = (verb, what, k) => row(`Step ${k}`, [t(verb, 'V3Small', g.soft), t(what, 'V3Mono')], { gap: 'space.tight', align: 'center' })
  return col('Panel', [
    row('Panel head', [row('Head start', [{ shape: 'Head square', kind: 'rect', size: [8, 8], fill: g.fg }, t('Claude Code', 'V3Glass')], { gap: 'space.snug', align: 'center' }),
      row('Head end', [square('Live square', 6, 'color.signal.dot'), t('Working', 'V3Small', g.soft)], { gap: 'space.tight', align: 'center' })],
    { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug', inline: 'space.item' } }),
    { shape: 'Panel rule', kind: 'rect', size: [1, 1], w: 'fill', h: 1, fill: g.chip },
    col('Conversation', [
      row('Prompt', [t('Build the payment summary in Arabic', 'V3Glass', g.fg, { w: 'fill' })], { w: 'fill', pad: 'space.snug', fill: g.chip }),
      col('Steps', [step('Loaded', 'dualkit-rtl-layout', 1), step('Loaded', 'dualkit-gulf-formats', 2)], { gap: 'space.tight' }),
      row('Approve row', [row('Approve', [text('Approve and run', 'V3Glass')], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, fill: '#ffffffeb' }),
        row('Edit', [t('Edit', 'V3Glass')], { pad: { block: 'space.snug', inline: 'space.item' }, stroke: { color: g.chip, width: 1 } })], { w: 'fill', gap: 'space.tight' }),
    ], { w: 'fill', gap: 'space.item', pad: 'space.item' }),
  ], { w: 340, ...g.panel })
}

const option = (g) => col(`${g.name} option`, [
  painting(`${g.name} painting`, [panel(g)], { h: 400 }),
  col(`${g.name} caption`, [text(g.name, 'V3Step'), text(g.note, 'V3Small', { color: 'color.text.soft', w: 'fill' })], { w: 'fill', gap: 'space.tight' }),
], { w: 520, gap: 'space.item' })

export function glassOptions() {
  return {
    screen: 'Dualkit · Glass options · v3',
    size: [2280, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary', pad: 'space.v2.tile', gap: 'space.card',
    children: [
      text('Glass: pick one', 'V3H2'),
      row('Options', Object.values(GLASS).map(option), { gap: 'space.card' }),
      hline('Options rule'),
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'glass-options-v3.json'), JSON.stringify(glassOptions(), null, 2))
  console.log('wrote specs/glass-options-v3.json')
}
