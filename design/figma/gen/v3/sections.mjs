// v3 full-viewport sections, the numbers and standards rows, and the grand footer.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GLASS_LINE, band, button, col, frame, glass, gsoft, gtext, hline, icon, label, mark, row, square, text, vline } from './parts.mjs'

const marksTs = readFileSync(resolve(import.meta.dirname, '../../../../apps/site/lib/marks.ts'), 'utf8')
const toolPath = (name) => marksTs.match(new RegExp(`name: '${name.replace('.', '\\.')}',[^}]*?path: '([^']+)'`))[1]
const VIEW = 900

export const S = {
  statement: [['Every Gulf product ships in two directions.', true], ['Coding agents get the second one wrong.', true], ['Dualkit teaches them to get it right.', false]],
  region: {
    label: 'Across the Gulf', heading: 'Built for the Gulf,\ncity by city.',
    lede: 'Six currencies, the Hijri calendar, and the formats people type every day.',
    cities: [['Kuwait City', 'KWD, 3 decimals', 500, 0.36], ['Riyadh', 'SAR, Umm al-Qura', 640, 0.56], ['Manama', 'BHD, 3 decimals', 780, 0.42], ['Doha', 'QAR', 900, 0.50], ['Dubai', 'AED, +971', 1040, 0.60], ['Muscat', 'OMR, 3 decimals', 1160, 0.47]],
  },
  video: { heading: 'Made for the people\nbuilding the region.', action: 'Get started' },
  numbers: {
    label: 'In numbers', heading: 'Open source, tested,\nand checked every month.',
    stats: [['1,031', 'tests across the kit'], ['20', 'rules in dualkit check'], ['6', 'Gulf currencies'], ['4', 'skills for your agent']],
  },
  seals: [['UAX #9', 'Unicode bidi'], ['ISO 13616', 'IBAN'], ['Umm al-Qura', 'Hijri calendar'], ['npm', 'Provenance'], ['MIT', 'Open source'], ['Native', 'Arabic review']],
  sealNote: 'Standards Dualkit follows. None of them is a third-party certification.',
  footer: {
    line: 'Arabic and English, built right the first time.',
    columns: [['Product', ['Skills', 'Format', 'Starter', 'Check', 'Bench']], ['Resources', ['Docs', 'Updates', 'Status', 'Registry']], ['Community', ['GitHub', 'Discussions', 'npm', 'Plugin directory']], ['Legal', ['MIT licence', 'Privacy']]],
    legal: '© 2026 Dualkit. MIT licensed.',
  },
}

/** Full-viewport statement: one sentence per line, the words read in as you scroll (shown mid-scroll). */
export function statement() {
  return row('Statement', [col('Statement lines', S.statement.map(([t, read], k) => text(t, 'V3Display', { color: read ? 'color.text.primary' : 'color.text.ghost', name: `Line ${k + 1}` })), { w: 1200, gap: 'space.hair' })],
    { w: 'fill', h: VIEW, justify: 'center', align: 'center' })
}

/** Full-bleed painting with a route across the dunes and a marker per city. */
export function region() {
  const r = S.region
  const pts = r.cities.map(([, , x, y]) => [x + 120, Math.round(y * VIEW)])
  const path = pts.map(([x, y], k) => (k ? `L${x} ${y}` : `M${x} ${y}`)).join(' ')
  const route = { shape: 'Route', kind: 'svg', size: [1440, VIEW], abs: { start: 0, top: 0 },
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 ${VIEW}" fill="none"><path d="${path}" stroke="#fff" stroke-width="1.5" stroke-opacity=".85"/>${pts.map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#fff"/><path d="M${x} ${y - 10}V${y - 120}" stroke="#fff" stroke-opacity=".7" stroke-dasharray="3 4"/>`).join('')}</svg>` }
  const markers = r.cities.map(([city, fmt, x, y]) => glass(`${city} marker`, [gtext(city), gsoft(fmt)], { pad: { block: 'space.tight', inline: 'space.snug' }, abs: { start: x + 120 - 8, top: Math.round(y * VIEW) - 176 } }))
  return col('Region', [
    route, ...markers,
    band('Region head', [col('Region title', [row('Region label', [square('Region square', 7, 'color.v3.glassText'), text(r.label, 'V3Label', { color: 'color.v3.glassText' })], { gap: 'space.snug', align: 'center' }),
      text(r.heading, 'V3H2', { color: 'color.v3.glassText', name: 'Heading' }), text(r.lede, 'V3Lede', { color: 'color.v3.glassSoft', w: 420, name: 'Lede' })], { gap: 'space.group' })], { pad: { top: 'space.120' } }),
  ], { w: 'fill', h: VIEW, clip: true, fill: { type: 'image', image: 'dusk', scaleMode: 'FILL' } })
}

/** Full-bleed film still with one line and one action, bottom start. */
export function video() {
  const v = S.video
  const scrim = { stack: 'Scrim', dir: 'col', children: [], w: 1440, h: VIEW, abs: { start: 0, top: 0 }, fill: { type: 'linear', angle: 90, stops: [[0.35, '#0b0a0900'], [1, '#0b0a09b3']] } }
  return col('Video', [
    scrim,
    band('Video copy', [col('Video words', [text(v.heading, 'V3Display', { color: 'color.v3.glassText', name: 'Heading' }),
      row('Video action', [text(v.action, 'V3Label'), icon('arrow', 'color.text.primary', 14)], { gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.group' }, fill: 'color.v3.glassButton' })], { gap: 'space.card' })],
    { pad: { bottom: 'space.120' } }),
  ], { w: 'fill', h: VIEW, justify: 'end', clip: true, fill: [{ type: 'image', image: 'video', scaleMode: 'FILL' }][0] })
}

export function numbers() {
  const n = S.numbers
  const cell = ([num, what]) => col(`${what} stat`, [text(num, 'V3Display', { name: 'Number' }), text(what, 'V3Body', { color: 'color.text.soft', name: 'What' })], { w: 'fill', gap: 'space.tight', pad: 'space.card' })
  return band('Numbers', [
    col('Numbers title', [label(n.label), text(n.heading, 'V3H2', { name: 'Heading' })], { gap: 'space.group' }),
    frame('Numbers frame', n.stats.flatMap((s, k) => [...(k ? [vline(`Numbers rule ${k}`)] : []), cell(s)]), { joins: [300, 600, 900] }),
  ], { gap: 'space.v2.inner', pad: { top: 'space.200' } })
}

const seal = ([big, small]) => col(`${big} seal`, [text(big, 'V3Label', { name: 'Standard' }), text(small, 'V3Small', { color: 'color.text.faint', name: 'Scope' })],
  { w: 112, h: 112, justify: 'center', align: 'center', gap: 'space.hair', stroke: { color: 'color.v3.line', width: 'size.stroke' } })

export function footerGrand() {
  const f = S.footer
  const social = (name, svg) => row(`${name} social`, [svg], { w: 40, h: 40, justify: 'center', align: 'center', stroke: { color: 'color.v3.line', width: 'size.stroke' } })
  const gh = { shape: 'GitHub glyph', kind: 'svg', size: [16, 16], tint: 'color.text.primary', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>` }
  const npm = { shape: 'npm glyph', kind: 'svg', size: [16, 16], tint: 'color.text.primary', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="${toolPath('npm')}"/></svg>` }
  const claude = { shape: 'Claude glyph', kind: 'svg', size: [16, 16], tint: 'color.text.primary', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="${toolPath('Claude Code')}"/></svg>` }
  const brand = col('Footer brand', [
    row('Footer brand row', [mark('Footer mark'), text('Dualkit', 'V3Step')], { gap: 'space.snug', align: 'center' }),
    text(f.line, 'V3Body', { color: 'color.text.soft', w: 320 }),
    row('Socials', [social('GitHub', gh), social('npm', npm), social('Claude', claude)], { gap: 'space.tight' }),
  ], { w: 'fill', gap: 'space.group' })
  const column = ([title, links]) => col(`${title} column`, [text(title, 'V3Label', { name: 'Column title' }), ...links.map((l) => text(l, 'V3Body', { color: 'color.text.soft', name: l }))], { w: 150, gap: 'space.snug' })
  return col('Footer', [
    band('Footer top', [
      row('Footer columns', [brand, row('Link columns', f.columns.map(column), { gap: 'space.card' })], { w: 'fill', justify: 'between' }),
      col('Seals block', [row('Seals', S.seals.map(seal), { gap: 'space.snug' }), text(S.sealNote, 'V3Small', { color: 'color.text.faint' })], { gap: 'space.item' }),
      hline('Footer rule'),
      row('Legal row', [text(f.legal, 'V3Small', { color: 'color.text.soft' }), row('Made by', [text('Made by', 'V3Small', { color: 'color.text.soft' }), text('Sam Santos', 'V3Small', { name: 'Maker link' }), { shape: 'Mascot', kind: 'ellipse', size: [18, 18], fill: 'color.surface.inverse' }], { gap: 'space.tight', align: 'center' })],
        { w: 'fill', justify: 'between', align: 'center' }),
    ], { gap: 'space.card', pad: { top: 'space.160' } }),
    row('Footer painting', [text('Dualkit', 'V2Wordmark', { color: 'color.v3.glassText', name: 'Wordmark' })], { w: 'fill', h: 520, justify: 'center', align: 'end', clip: true, fill: { type: 'image', image: 'footer', scaleMode: 'FILL' } }),
  ], { w: 'fill', gap: 'space.v2.inner', pad: { top: 'space.200' } })
}
