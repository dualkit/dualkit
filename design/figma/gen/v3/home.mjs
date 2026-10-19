// dualkit.dev home, v3: hard edges, ruled frames with corner ticks, the dunes painting behind frosted glass.
// Run: node gen/v3/home.mjs, which writes specs/home-v3-desktop.json and specs/hero-v3-warm.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { V3 } from './copy.mjs'
import { heroGraphic } from './hero-graphic.mjs'
import { footerGrand, numbers, region, statement, video } from './sections.mjs'
import { LINE, GLASS_LINE, band, button, col, frame, glass, gsoft, gtext, header, hline, icon, label, mark, meter, painting, row, square, text, vline } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const ROOT = resolve(import.meta.dirname, '../../../..')
const MARKS = resolve(ROOT, 'design/assets/marks')
const CONTENT = 1200
const SECTION = 'space.200'

const marksTs = readFileSync(resolve(ROOT, 'apps/site/lib/marks.ts'), 'utf8')
const toolPath = (name) => marksTs.match(new RegExp(`name: '${name.replace('.', '\\.')}',[^}]*?path: '([^']+)'`))[1]
const toolSvg = (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="${toolPath(name)}"/></svg>`
const makerSvg = (file) => readFileSync(resolve(MARKS, `${file}.svg`), 'utf8').replace(/<title>.*?<\/title>/, '')

export function nav(active) {
  const n = V3.nav
  return col('Nav', [
    band('Nav', [row('Nav row', [
      row('Brand', [mark(), text('Dualkit', 'V3Label')], { w: 240, gap: 'space.tight', align: 'center' }),
      row('Links', n.links.map((l) => l === active
        ? col(`${l} active`, [text(l, 'V3Label', { name: l }), row('Active tick', [], { w: 'fill', h: 2, fill: 'color.v3.tick' })], { gap: 'space.hair' })
        : text(l, 'V3Label', { color: 'color.text.soft', name: l })), { gap: 'space.block', align: 'center' }),
      row('Nav end', [button(n.github, 'outline'), button(n.cta)], { w: 240, justify: 'end', gap: 'space.tight', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center' })], { pad: { block: 'space.item' } }),
    hline('Nav rule'),
  ], { w: 'fill' })
}

// The hero product: Claude Code in glass on the left, the Arabic checkout it built as a solid card on the right.
export function claudePanel() {
  const w = V3.window
  const step = ([verb, what], k) => row(`Step ${k + 1}`, [gsoft(verb, 'V3Small', { name: 'Verb' }), text(what, 'V3Mono', { color: 'color.v3.glassText', name: 'Target' })], { gap: 'space.tight', align: 'center' })
  return glass('Claude Code panel', [
    row('Panel head', [row('Head start', [square('Head square', 8, 'color.v3.glassText'), gtext(w.title)], { gap: 'space.snug', align: 'center' }),
      row('Head end', [square('Live square', 6, 'color.signal.dot'), gsoft('Working')], { gap: 'space.tight', align: 'center' })],
    { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug', inline: 'space.item' } }),
    hline('Panel rule', 'color.v3.glassLine'),
    col('Conversation', [
      row('Prompt', [gtext(w.prompt, 'V3Glass', { w: 'fill', name: 'Prompt text' })], { w: 'fill', pad: { block: 'space.snug', inline: 'space.snug' }, fill: 'color.v3.glassLine' }),
      col('Steps', w.steps.map(step), { gap: 'space.tight' }),
      gsoft(w.reply, 'V3Small', { w: 'fill', name: 'Reply' }),
    ], { w: 'fill', gap: 'space.item', pad: 'space.item' }),
  ], { w: 420 })
}

function checkoutCard() {
  const ar = (t, style = 'V2ArBody', extra = {}) => text(t, style, { align: 'end', ...extra })
  const line = (k, v) => row(`${k} row`, [ar(v, 'V2ArBody', { name: 'Value' }), ar(k, 'V2ArBody', { color: 'color.text.soft', name: 'Key' })], { w: 'fill', justify: 'between' })
  return col('Checkout card', [
    ar('ملخص الدفع', 'V2ArTitle', { name: 'Title' }),
    col('Amount', [ar('المبلغ المستحق', 'V2ArBody', { color: 'color.text.soft' }), ar('1,234.50 د.إ', 'V2ArAmount', { name: 'Amount value' })], { w: 'fill', align: 'end' }),
    hline('Card rule'),
    line('تاريخ الاستحقاق', '1 رمضان 1447 هـ'),
    line('رقم الجوال', '+971 50 123 4567'),
    row('Pay', [ar('إتمام الدفع', 'V2ArBody', { color: 'color.text.inverse' })], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, fill: 'color.surface.inverse' }),
  ], { w: 320, gap: 'space.item', align: 'end', pad: 'space.card', fill: 'color.surface.page' })
}

export function hero(ground) {
  const h = V3.hero
  return col('Hero', [
    band('Hero head', [row('Hero row', [
      col('Hero title', [label(h.label), text(h.headline, 'V3Display', { name: 'Headline' })], { gap: 'space.card' }),
      col('Hero side', [text(h.lede, 'V3Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
        row('Hero actions', [button(h.primary, 'ink', 'arrow'), button(h.secondary, 'outline')], { gap: 'space.tight' })], { w: 400, gap: 'space.card' }),
    ], { w: 'fill', justify: 'between', align: 'end' })], { pad: { top: 'space.160' } }),
    band('Hero media', [frame('Hero frame', [
      heroGraphic(3),
    ], { pad: 'space.card' })]),
  ], { w: 'fill', gap: 'space.v2.inner', ...(ground ? { fill: ground } : {}) })
}

// How it works: three cells in one ruled frame, each a small painting with one piece of glass UI.
export function connectMedia() {
  const chip = (name) => glass(`${name} chip`, [gtext(name)], { pad: { block: 'space.tight', inline: 'space.snug' } })
  const wires = { shape: 'Wires', kind: 'svg', size: [56, 104], tint: 'color.v3.glassText',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 104" fill="none"><path d="M0 12H20V92H0M0 52H56" stroke="#fff" stroke-width="1"/><rect x="52" y="50" width="4" height="4" fill="#fff"/></svg>' }
  const node = col('Dualkit node', [row('Node square', [mark('Node mark', 'color.mark.onPanel')], { w: 64, h: 64, justify: 'center', align: 'center', fill: 'color.surface.page' })],
    { pad: 'space.tight', stroke: { color: 'color.v3.glassText', width: 'size.stroke' } })
  return row('Connect media', [col('Chips', ['Claude Code', 'Cursor', 'shadcn'].map(chip), { gap: 'space.item' }), wires, node], { align: 'center' })
}

export function rankMedia() {
  const r = (k, name, share, on) => row(`Rank ${k}`, [
    row(`Rank ${k} start`, [gsoft(String(k), 'V3Small'), text(name, 'V3Mono', { color: 'color.v3.glassText' })], { gap: 'space.snug', align: 'center' }),
    meter(`Rank ${k} meter`, share),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.tight', inline: 'space.snug' }, ...(on ? { fill: 'color.v3.glassLine' } : {}) })
  return glass('Loaded panel', [
    row('Loaded head', [gtext('Loaded for this task'), row('Now', [square('Now square', 6, 'color.v3.glassText'), gsoft('now')], { gap: 'space.tight', align: 'center' })], { w: 'fill', justify: 'between', align: 'center', pad: { bottom: 'space.tight' } }),
    r(1, 'rtl-layout', 0.92, true), r(2, 'gulf-formats', 0.66), r(3, 'type-pairing', 0.4),
  ], { w: 268, gap: 'space.hair', pad: 'space.snug' })
}

export function checkMedia() {
  const bar = (k, w) => ({ shape: `Skeleton ${k}`, kind: 'rect', size: [w, 4], fill: 'color.v3.glassLine' })
  return glass('Check panel', [
    row('Check head', [row('Check title', [row('Check square', [icon('check', 'color.text.primary', 12)], { w: 18, h: 18, justify: 'center', align: 'center', fill: 'color.v3.glassButton' }), gtext('dualkit check')], { gap: 'space.snug', align: 'center' }),
      row('Score', [square('Score square', 6, 'color.signal.dot'), gsoft('20 of 20')], { gap: 'space.tight', align: 'center' })], { w: 'fill', justify: 'between', align: 'center' }),
    col('Lines', [bar(1, 236), bar(2, 196), bar(3, 140)], { gap: 'space.tight' }),
    row('Check actions', [row('Open report', [icon('check', 'color.text.primary', 12), text('Open report', 'V3Glass')], { w: 'fill', gap: 'space.tight', justify: 'center', align: 'center', pad: { block: 'space.tight' }, fill: 'color.v3.glassButton' }),
      row('Copy', [gtext('Copy')], { pad: { block: 'space.tight', inline: 'space.snug' }, stroke: GLASS_LINE })], { w: 'fill', gap: 'space.tight' }),
  ], { w: 268, gap: 'space.item', pad: 'space.item' })
}

function how() {
  const p = V3.how
  const media = [connectMedia(), rankMedia(), checkMedia()]
  const cell = ([no, title, body], k) => col(`Step ${no}`, [
    painting(`Step ${no} painting`, [media[k]], { h: 240 }),
    col(`Step ${no} text`, [text(no, 'V3Small', { color: 'color.text.faint', name: 'Number' }), text(title, 'V3Step', { name: 'Title' }), text(body, 'V3Body', { color: 'color.text.soft', w: 'fill', name: 'Body' })], { w: 'fill', gap: 'space.tight' }),
  ], { w: 'fill', gap: 'space.card', pad: 'space.card' })
  const third = CONTENT / 3
  return band('How', [
    header('How', p),
    frame('How frame', p.steps.flatMap((s, k) => [...(k ? [vline(`How rule ${k}`)] : []), cell(s, k)]), { joins: [third, third * 2] }),
  ], { gap: 'space.v2.inner', pad: { top: SECTION } })
}

// The kit: an accordion on the left, the open part's product on the right, as in the reference's use cases.
/** The open Skills item, a closed item, and the Skills product panel; shared with the phone frame. */
export function kitOpen(pad = 'space.card', wrap = false) {
  const o = V3.kit.open
  const point = (t) => row(`${t} point`, [wrap ? row('Point check', [icon('check', 'color.text.primary', 14)], { pad: { top: 'space.hair' } }) : icon('check', 'color.text.primary', 14), text(t, 'V3Body', { name: 'Point', ...(wrap ? { w: 'fill' } : {}) })], { gap: 'space.snug', ...(wrap ? { w: 'fill', align: 'start' } : { align: 'center' }) })
  const open = col('Skills item', [
    row('Skills item head', [row('Skills item name', [text('01', 'V3Small', { color: 'color.text.faint' }), text(o.name, 'V3Step')], { gap: 'space.item', align: 'center' }), square('Open square', 8)], { w: 'fill', justify: 'between', align: 'center' }),
    col('Skills detail', [text(o.title, 'V3Step', { name: 'Title' }), text(o.body, 'V3Body', { color: 'color.text.soft', w: 'fill', name: 'Body' }), col('Points', o.points.map(point), { gap: 'space.tight' })], { w: 'fill', gap: 'space.snug', pad: { start: pad } }),
  ], { w: 'fill', gap: 'space.item', pad })
  return open
}

export const kitClosed = (name, k, pad = 'space.card') => row(`${name} item`, [row(`${name} item name`, [text(`0${k + 2}`, 'V3Small', { color: 'color.text.faint' }), text(name, 'V3Step')], { gap: 'space.item', align: 'center' }),
    row('Closed square', [], { w: 8, h: 8, stroke: LINE })], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.item', inline: pad } })

export function skillsPanel(w = 380) {
  const ar = (t, extra = {}) => text(t, 'V2ArBody', { color: 'color.v3.glassText', align: 'end', ...extra })
  const line = (k, v, tag) => col(`${k} line`, [hline(`${k} rule`, 'color.v3.glassLine'), row(`${k} row`, [
    row(`${k} value`, [...(tag ? [row('Bdi tag', [text('bdi', 'V3Small', { color: 'color.text.primary' })], { pad: { inline: 'space.tight' }, fill: 'color.v3.glassButton' })] : []), ar(v)], { gap: 'space.snug', align: 'center' }),
    ar(k, { color: 'color.v3.glassSoft' })], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug' } })], { w: 'fill' })
  return glass('Skills panel', [
    row('Skills panel head', [row('Fixed', [square('Fixed square', 6, 'color.signal.dot'), gsoft('Fixed')], { gap: 'space.tight', align: 'center' }), gtext('ملخص الدفع', 'V2ArBody')], { w: 'fill', justify: 'between', align: 'center', pad: { bottom: 'space.snug' } }),
    line('المبلغ', '1,234.50 د.إ'), line('الجوال', '+971 50 123 4567', true), line('التاريخ', '1 رمضان 1447 هـ'),
    row('Note', [gsoft('Isolated the phone number so it reads left to right.', 'V3Small', { w: 'fill' })], { w: 'fill', pad: 'space.snug', stroke: GLASS_LINE }),
    row('View diff', [text('View the diff', 'V3Glass')], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, fill: 'color.v3.glassButton' }),
  ], { w, gap: 'space.snug', pad: 'space.item' })
}

function kit() {
  const p = V3.kit
  const list = col('Kit list', [kitOpen(), ...p.rest.flatMap((n, k) => [hline(`Kit rule ${k + 1}`), kitClosed(n, k)])], { w: 560 })
  const panel = skillsPanel()
  return band('Kit', [
    header('Kit', p),
    frame('Kit frame', [list, vline('Kit split'), painting('Kit painting', [panel], { h: 'fill' })], { joins: [560] }),
  ], { gap: 'space.v2.inner', pad: { top: SECTION } })
}

function works() {
  const p = V3.works
  const tile = ([name, role], k) => col(`${name} tile`, [
    row(`${name} glyph box`, [{ shape: `${name} mark`, kind: 'svg', size: [18, 18], svg: toolSvg(name), tint: 'color.text.primary' }], { w: 40, h: 40, justify: 'center', align: 'center', stroke: LINE }),
    col(`${name} words`, [text(name, 'V3Label', { name: 'Name' }), text(role, 'V3Small', { color: 'color.text.faint', name: 'Role' })]),
  ], { w: 'fill', gap: 'space.card', pad: 'space.item' })
  const ask = col('Ask tile', [
    row('Ask box', [text('+', 'V3Label', { color: 'color.text.faint' })], { w: 40, h: 40, justify: 'center', align: 'center', stroke: { ...LINE, dash: [3, 3] } }),
    col('Ask words', [text(p.ask[0], 'V3Label', { color: 'color.text.soft' }), text(p.ask[1], 'V3Small', { color: 'color.text.faint' })]),
  ], { w: 'fill', gap: 'space.card', pad: 'space.item' })
  const cells = [...p.tools.map(tile), ask]
  const sixth = CONTENT / 6
  return band('Works', [
    header('Works', { ...p, action: button(p.action, 'ink', 'arrow') }),
    frame('Works frame', cells.flatMap((c, k) => [...(k ? [vline(`Works rule ${k}`)] : []), c]), { joins: [1, 2, 3, 4, 5].map((k) => sixth * k) }),
  ], { gap: 'space.v2.inner', pad: { top: SECTION } })
}

export function slider(dir, w = 340) {
  const rtl = dir === 'rtl'
  const knob = row('Knob', [icon(rtl ? 'back' : 'forward', 'color.text.primary', 16)], { w: 48, h: 48, justify: 'center', align: 'center', fill: 'color.v3.glassButton' })
  const words = row('Slider words', [rtl ? text(V3.mirror.ar, 'V2ArBody', { color: 'color.v3.glassText' }) : gtext(V3.mirror.en, 'V3Glass')], { w: 'fill', justify: 'center' })
  return glass(`${rtl ? 'RTL' : 'LTR'} slider`, [row('Slider row', rtl ? [words, knob] : [knob, words], { w: 'fill', align: 'center' })], { w, pad: 'space.tight' })
}

function mirror() {
  const p = V3.mirror
  const cell = (dir, k) => col(`${p.captions[k]} cell`, [
    painting(`${p.captions[k]} painting`, [slider(dir)], { h: 320 }),
    row(`${p.captions[k]} caption`, [text(p.captions[k], 'V3Label'), text(dir.toUpperCase() === 'RTL' ? 'dir="rtl"' : 'dir="ltr"', 'V3Mono', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' }),
  ], { w: 'fill', gap: 'space.item', pad: 'space.card' })
  return band('Mirror', [
    header('Mirror', p),
    frame('Mirror frame', [cell('ltr', 0), vline('Mirror rule'), cell('rtl', 1)], { joins: [CONTENT / 2] }),
  ], { gap: 'space.v2.inner', pad: { top: SECTION } })
}

/** The Bench range track: a hollow dot for the model alone, a filled one with Dualkit, the lift between. `ink` and `line` recolour it for glass. */
export const benchDot = (name, filled, ink = 'color.v3.tick', ground = 'color.v3.ground') => row(name, [], { w: 10, h: 10, ...(filled ? { fill: ink } : { fill: ground, stroke: { color: ink, width: 'size.stroke' } }) })
export const benchTrack = (a, d, TRACK = 520, ink = 'color.v3.tick', line = 'color.v3.line', ground = 'color.v3.ground') => row('Track', [
  { shape: 'Track line', kind: 'rect', size: [TRACK, 1], fill: line },
  { shape: 'Lift', kind: 'rect', size: [Math.round((d - a) / 100 * TRACK), 2], fill: ink, abs: { start: Math.round(a / 100 * TRACK), top: 4 } },
  { ...benchDot('Alone dot', false, ink, ground), abs: { start: Math.round(a / 100 * TRACK) - 5, top: 0 } },
  { ...benchDot('Dualkit dot', true, ink, ground), abs: { start: Math.round(d / 100 * TRACK) - 5, top: 0 } },
], { w: TRACK, h: 10, align: 'center' })
export const makerSvgFor = (m) => makerSvg(m)

function bench() {
  const p = V3.bench
  const dot = benchDot
  const track = (a, d) => benchTrack(a, d)
  const r = ([name, m, a, d], k) => row(`${name} row`, [
    row(`${name} name`, [text(String(k + 1), 'V3Small', { color: 'color.text.faint' }), { shape: `${name} maker`, kind: 'svg', size: [16, 16], svg: makerSvg(m), tint: 'color.text.primary' }, text(name, 'V3Label')], { w: 300, gap: 'space.item', align: 'center' }),
    track(a, d),
    row(`${name} figures`, [text(`${a}`, 'V3Small', { color: 'color.text.faint' }), text(`${d}`, 'V3Label'), text(`+${d - a}`, 'V3Mono')], { w: 160, gap: 'space.item', justify: 'end', align: 'center' }),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.item', inline: 'space.card' } })
  const legend = row('Legend', [
    row('Legend alone', [dot('Legend alone dot', false), text('Alone', 'V3Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    row('Legend dualkit', [dot('Legend dualkit dot', true), text('With Dualkit', 'V3Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    text('Sample data until 1 November', 'V3Small', { color: 'color.text.faint' }),
  ], { w: 'fill', gap: 'space.card', align: 'center', pad: { block: 'space.item', inline: 'space.card' } })
  return band('Bench', [
    header('Bench', { ...p, action: button(p.action, 'outline', 'arrow') }),
    frame('Bench frame', [legend, ...p.rows.flatMap((x, k) => [hline(`Bench rule ${k + 1}`), r(x, k)])], { dir: 'col' }),
  ], { gap: 'space.v2.inner', pad: { top: SECTION } })
}

function closing() {
  const c = V3.closing
  const command = row('Command', [text(c.command, 'V3Mono', { color: 'color.v3.glassText', w: 'fill' }), icon('copy', 'color.v3.glassSoft', 14)], { w: 'fill', align: 'center', pad: { block: 'space.snug', inline: 'space.item' }, stroke: GLASS_LINE })
  const box = glass('Closing panel', [
    text(c.heading, 'V3H2', { color: 'color.v3.glassText', w: 'fill', name: 'Heading' }),
    command,
    row('Closing actions', [row('Get started button', [text(c.primary, 'V3Label'), icon('arrow', 'color.text.primary', 14)], { gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.group' }, fill: 'color.v3.glassButton' }),
      row('Docs button', [gtext(c.secondary, 'V3Label')], { pad: { block: 'space.snug', inline: 'space.group' }, stroke: GLASS_LINE })], { gap: 'space.tight' }),
  ], { w: 560, gap: 'space.card', pad: 'space.v2.tile' })
  return band('Closing', [frame('Closing frame', [painting('Closing painting', [box], { h: 600 })], { pad: 'space.card' })], { pad: { top: SECTION } })
}

function footer() {
  const f = V3.footer
  const mascot = { shape: 'Mascot', kind: 'ellipse', size: [56, 56], fill: 'color.surface.inverse' }
  const column = ([title, links]) => col(`${title} column`, [text(title, 'V3Small', { color: 'color.text.faint', name: 'Column title' }), ...links.map((l) => text(l, 'V3Body', { name: l })),
    ...(title === 'Made by' ? [row('Mascot row', [mascot], { pad: { top: 'space.item' } })] : [])],
  { w: 'fill', gap: 'space.snug', pad: 'space.card' })
  const brand = col('Footer brand', [row('Footer brand row', [mark('Footer mark'), text('Dualkit', 'V3Label')], { gap: 'space.tight', align: 'center' }),
    row('Status', [square('Status square', 6, 'color.signal.dot'), text('All systems normal', 'V3Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' })],
  { w: 'fill', gap: 'space.item', pad: 'space.card' })
  const quarter = CONTENT / 4
  return col('Footer', [
    band('Footer grid', [frame('Footer frame', [brand, ...f.columns.flatMap((c, k) => [vline(`Footer rule ${k + 1}`), column(c)])], { joins: [quarter, quarter * 2, quarter * 3] })]),
    row('Wordmark', [text('Dualkit', 'V2Wordmark', { color: 'color.text.ghost', name: 'Wordmark text' })], { w: 'fill', h: 'size.v2.cell', justify: 'center', align: 'start', clip: true }),
    band('Footer legal', [row('Legal row', [text(f.legal, 'V3Small', { color: 'color.text.faint' }), text('Build for the Gulf. In both directions.', 'V3Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' })], { pad: { block: 'space.group' } }),
  ], { w: 'fill', gap: 'space.v2.inner', pad: { top: SECTION } })
}

export function homeV3() {
  return {
    screen: 'Dualkit · Home · Desktop · v3',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary',
    children: [nav(), hero(), statement(), how(), region(), kit(), works(), video(), mirror(), bench(), numbers(), closing(), footerGrand()],
  }
}

/** The hero on the reference's warm ground, to compare grounds side by side. */
export function heroWarm() {
  return {
    screen: 'Dualkit · Hero · Warm ground option · v3',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.groundWarm', textColor: 'color.text.primary',
    children: [nav(), hero(), row('Hero foot', [], { w: 'fill', h: 120 })],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'home-v3-desktop.json'), JSON.stringify(homeV3(), null, 2))
  writeFileSync(resolve(SPECS, 'hero-v3-warm.json'), JSON.stringify(heroWarm(), null, 2))
  console.log('wrote specs/home-v3-desktop.json, specs/hero-v3-warm.json')
}
