// The v3 hero graphic: agents wired into Dualkit, Dualkit wired into the Arabic screen it fixes, built like the references.
// Three keyframes (pulses travelling, panel building, settled) for sign-off next to the live prototype.
// Run: node gen/v3/hero-graphic.mjs, which writes specs/hero-graphic-v3.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MARK } from '../icons.mjs'
import { GLASS_LINE, col, glass, gsoft, gtext, hline, icon, mark, painting, row, square, text } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const marksTs = readFileSync(resolve(import.meta.dirname, '../../../../apps/site/lib/marks.ts'), 'utf8')
const toolPath = (name) => marksTs.match(new RegExp(`name: '${name.replace('.', '\\.')}',[^}]*?path: '([^']+)'`))[1]
const toolSvg = (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="${toolPath(name)}"/></svg>`

const GLOW = '<defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
const pulse = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="url(#g)"/><circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`
const CHIP_Y = [18, 80, 142]

function wiresIn(pulseAt) {
  const p = pulseAt ? pulse(...pulseAt) : ''
  return { shape: 'Wires in', kind: 'svg', size: [96, 160],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 160" fill="none">${GLOW}<path d="M0 ${CHIP_Y[0]}H40V${CHIP_Y[2]}H0M0 ${CHIP_Y[1]}H96" stroke="#fff" stroke-opacity=".55"/><rect x="38" y="${CHIP_Y[1] - 2}" width="4" height="4" fill="#fff"/>${p}</svg>` }
}
function wireOut(pulseAt) {
  const p = pulseAt != null ? pulse(pulseAt, 12) : ''
  return { shape: 'Wire out', kind: 'svg', size: [96, 24], svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 24" fill="none">${GLOW}<path d="M0 12H96" stroke="#fff" stroke-opacity=".55"/>${p}</svg>` }
}

const chip = (name) => glass(`${name} chip`, [row(`${name} chip row`, [{ shape: `${name} mark`, kind: 'svg', size: [14, 14], svg: toolSvg(name), tint: 'color.v3.glassText' }, gtext(name)], { gap: 'space.tight', align: 'center' })],
  { w: 156, pad: { block: 'space.tight', inline: 'space.snug' } })

function node(spinning, loaded) {
  const dots = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return `<circle cx="${(20 + Math.cos(a) * 13).toFixed(1)}" cy="${(20 + Math.sin(a) * 13).toFixed(1)}" r="${(2 + (k % 8) * 0.25).toFixed(2)}" fill="#09090b" fill-opacity="${(0.3 + k * 0.1).toFixed(2)}"/>` }).join('')
  const face = spinning
    ? { shape: 'Spinner', kind: 'svg', size: [40, 40], svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${dots}</svg>` }
    : row('Node mark', [{ shape: 'Mark start', kind: 'svg', size: [18, 40], svg: MARK.start, tint: 'color.text.primary' }, { shape: 'Mark end', kind: 'svg', size: [18, 40], svg: MARK.end, tint: 'color.mark.onPanel' }], { gap: 'space.mark' })
  const handle = (n, abs) => ({ ...square(n, 6, 'color.v3.glassText'), abs })
  const frameBox = col('Selection', [
    row('Node square', [face], { w: 96, h: 96, justify: 'center', align: 'center', fill: 'color.surface.page' }),
    handle('Handle top start', { start: -3, top: -3 }), handle('Handle top end', { end: -3, top: -3 }),
    handle('Handle bottom start', { start: -3, bottom: -3 }), handle('Handle bottom end', { end: -3, bottom: -3 }),
  ], { pad: 'space.tight', stroke: { color: 'color.v3.glassText', width: 'size.stroke' } })
  const tag = glass('Loaded tag', [row('Loaded row', [square('Loaded square', 6, loaded === 4 ? 'color.signal.dot' : 'color.v3.glassText'), gsoft(`Loaded ${loaded} of 4 skills`)], { gap: 'space.tight', align: 'center' })],
    { pad: { block: 'space.hair', inline: 'space.snug' } })
  return col('Node', [frameBox, tag], { gap: 'space.item', align: 'center' })
}

/** The built Arabic panel. `w` and `note` let the phone frame draw it narrower and without the note. */
export function panel(built, { w = 380, note = true } = {}) {
  const ar = (t, extra = {}) => text(t, 'V2ArBody', { color: 'color.v3.glassText', align: 'end', ...extra })
  const vis = (k) => (k <= built ? {} : { opacity: 0 })
  const line = (k, key, value, extra = []) => col(`${key} line`, [hline(`${key} rule`, 'color.v3.glassLine'), row(`${key} row`, [
    row(`${key} value`, [...extra, extra.length ? row('Ringed number', [ar(value)], { pad: { inline: 'space.tight' }, stroke: { color: 'color.v3.glassText', width: 'size.stroke' } }) : ar(value)], { gap: 'space.snug', align: 'center' }), ar(key, { color: 'color.v3.glassSoft' })],
  { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug' } })], { w: 'fill', ...vis(k) })
  const bdi = row('Bdi tag', [text('bdi', 'V3Small', { color: 'color.text.primary' })], { pad: { inline: 'space.tight' }, fill: 'color.v3.glassButton' })
  const check = col('Check line', [hline('Check rule', 'color.v3.glassLine'), row('Check row', [
    row('Check score', [gsoft('20 of 20'), row('Check bar', [{ shape: 'Check fill', kind: 'rect', size: [built >= 5 ? 96 : 40, 3], fill: 'color.v3.glassText' }], { w: 96, h: 3, fill: 'color.v3.glassLine' })], { gap: 'space.snug', align: 'center' }),
    text('dualkit check', 'V3Mono', { color: 'color.v3.glassSoft' })], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug' } })], { w: 'fill', ...vis(5) })
  return glass('Built panel', [
    row('Built head', [row('Fixed', [square('Fixed square', 6, 'color.signal.dot'), gsoft('Fixed')], { gap: 'space.tight', align: 'center' }), text('ملخص الدفع', 'V2ArTitle', { color: 'color.v3.glassText' })],
      { w: 'fill', justify: 'between', align: 'center', pad: { bottom: 'space.snug' }, ...vis(1) }),
    line(2, 'المبلغ', '1,234.50 د.إ'), line(3, 'التاريخ', '1 رمضان 1447 هـ'), line(4, 'الجوال', '+971 50 123 4567', [bdi]), check,
    ...(note ? [row('Note', [gsoft('Isolated the phone number so it reads left to right.', 'V3Small', { w: 'fill' })], { w: 'fill', pad: 'space.snug', stroke: GLASS_LINE, ...vis(6) })] : []),
    row('Pay', [text('إتمام الدفع', 'V2ArBody', { color: 'color.text.primary' })], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, fill: 'color.v3.glassButton', ...vis(7) }),
  ], { w, gap: 'space.snug', pad: 'space.item', ...(built ? {} : { opacity: 0 }) })
}

/** stage: 1 pulses on the way in, 2 panel building, 3 settled. */
export function heroGraphic(stage = 3, h = 640) {
  const conf = { 1: { inP: [40, 60], out: null, spin: true, loaded: 2, built: 0 }, 2: { inP: null, out: 70, spin: true, loaded: 4, built: 3 }, 3: { inP: null, out: null, spin: false, loaded: 4, built: 7 } }[stage]
  return painting(`Hero painting ${stage}`, [
    col('Chips', ['Claude Code', 'Cursor', 'shadcn'].map(chip), { h: 160, justify: 'between' }),
    wiresIn(conf.inP), node(conf.spin, conf.loaded), wireOut(conf.out), panel(conf.built),
  ], { h, align: 'center' })
}

export function keyframes() {
  const kf = (stage, title, note) => col(`Keyframe ${stage}`, [heroGraphic(stage, 520), col(`Keyframe ${stage} caption`, [text(title, 'V3Step'), text(note, 'V3Small', { color: 'color.text.soft', w: 'fill' })], { w: 'fill', gap: 'space.tight' })], { w: 1120, gap: 'space.item' })
  return {
    screen: 'Dualkit · Hero graphic keyframes · v3',
    size: [1200, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary', pad: 'space.card', gap: 'space.v2.tile',
    children: [
      kf(1, '0.0 to 1.2 s  ·  The agent calls Dualkit', 'Light pulses run along each wire from the agent chips into the node, 300 ms apart. The node spins while it loads the skills and the tag counts up.'),
      kf(2, '1.2 to 3.2 s  ·  The screen builds', 'A pulse leaves the node for the panel. The panel fades in, then each row lands 200 ms apart with a short blur. The bdi ring draws round the phone number.'),
      kf(3, '3.2 s  ·  Settled', 'The check bar fills to 20 of 20, the note lands, then the pay button turns solid. It holds for 3.5 s, then the rows clear and it runs again.'),
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'hero-graphic-v3.json'), JSON.stringify(keyframes(), null, 2))
  console.log('wrote specs/hero-graphic-v3.json')
}
