// dualkit.dev home, v2: minimal, square media, hairline grid, the product as the hero.
// Run: node gen/v2/home.mjs, which writes specs/home-v2-desktop.json and specs/menu-v2-desktop.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { V2 } from './copy.mjs'
import { LINE, band, col, hline, icon, mark, pill, row, seg, text, vline } from './parts.mjs'
import { productWindow, terminal } from './window.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export function nav() {
  const n = V2.nav
  const links = row('Links', [
    row('Product link', [text(n.product, 'V2Label', { color: 'color.text.soft' }), icon('chevron', 'color.text.faint', 12)], { gap: 'space.hair', align: 'center' }),
    ...n.links.map((l) => text(l, 'V2Label', { color: 'color.text.soft', name: l })),
  ], { gap: 'space.block', align: 'center' })
  return col('Nav', [
    band('Nav', [row('Nav row', [
      row('Brand', [mark(), text('Dualkit', 'Title')], { w: 'size.v2.nav', gap: 'space.tight', align: 'center' }),
      links,
      row('Nav end', [pill(n.github, { glyph: 'star' }), pill(n.cta, { primary: true })], { w: 'size.v2.nav', justify: 'end', gap: 'space.tight', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center' })], { pad: { block: 'space.item' } }),
    hline('Nav rule'),
  ], { w: 'fill' })
}

function hero() {
  const h = V2.hero
  return band('Hero', [
    text(h.headline, 'V2Hero', { name: 'Headline' }),
    row('Hero row', [
      col('Lede wrap', [text(h.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })], { w: 'size.v2.cli.w' }),
      row('Hero actions', [pill(h.primary, { primary: true }), pill(h.secondary, { glyph: 'star' })], { gap: 'space.tight' }),
    ], { w: 'fill', justify: 'between', align: 'end' }),
  ], { gap: 'space.v2.inner', pad: { top: 'space.v2.hero', bottom: 'space.v2.inner' } })
}

function stage() {
  return band('Stage', [
    row('Painting', [productWindow(), terminal()], {
      w: 'fill', h: 'size.v2.stage', justify: 'center', align: 'center', radius: 'radius.media', clip: true,
      fill: { type: 'image', image: 'dunes', scaleMode: 'FILL' },
    }),
  ])
}

const tileBox = (name, children, extra = {}) => col(name, children, {
  w: 'size.v2.half', h: 'size.v2.tile', justify: 'center', align: 'center', gap: 'space.group', pad: 'space.v2.tile',
  radius: 'radius.media', fill: 'color.surface.page', stroke: LINE, ...extra,
})

function ticks(name, total, filled) {
  return row(name, Array.from({ length: total }, (_, k) => ({ shape: `${name} tick ${k + 1}`, kind: 'rect', size: [3, 14],
    fill: k < filled ? 'color.surface.inverse' : 'color.surface.panel' })), { w: 'fill', justify: 'between', align: 'center' })
}

function skillsSection(p) {
  const cell = ([name, line], k) => col(`${name} cell`, [
    text(name, 'V2Mono', { name: 'Skill name' }),
    text(line, 'V2Body', { color: 'color.text.soft', w: 'fill', name: 'Skill line' }),
    col(`${name} score`, [ticks(`${name} ticks`, 24, k % 3 === 0 ? 0 : 8), row(`${name} score row`, [text('Without', 'V2Small', { color: 'color.text.faint' }), text(k % 3 === 0 ? '0/3' : '1/3', 'V2Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' }),
      ticks(`${name} ticks with`, 24, 24), row(`${name} score row with`, [text('With skills', 'V2Small'), text('3/3', 'V2Small')], { w: 'fill', justify: 'between' })], { w: 'fill', gap: 'space.tight' }),
  ], { w: 'fill', h: 'fill', justify: 'between', gap: 'space.group', pad: 'space.block' })
  return band('Skills', [
    row('Skills header', [
      text(p.heading, 'V2H2', { name: 'Heading' }),
      col('Skills lede wrap', [text(p.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })], { w: 'size.v2.cli.w' }),
    ], { w: 'fill', justify: 'between', align: 'end' }),
    row('Skill cells', p.skills.flatMap((sk, k) => [...(k ? [vline(`Skill rule ${k}`)] : []), cell(sk, k)]),
      { w: 'fill', h: 'size.v2.cli.h', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE }),
  ], { gap: 'space.v2.inner', pad: { top: 'space.v2.section' } })
}

export function formatTile() {
  const cell = (d, k) => row(`Digit ${k + 1}`, [text(d, 'V2ArAmount', { name: 'Digit' })], { w: 'size.v2.otp', h: 'size.v2.otp', justify: 'center', align: 'center', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })
  const otp = col('Code', [
    text('Verification code, typed in Arabic digits', 'V2Small', { color: 'color.text.soft' }),
    row('Code cells', ['٤', '٧', '٢', '٩'].map(cell), { gap: 'space.snug' }),
    row('Read as', [text('Read as', 'V2Small', { color: 'color.text.faint' }), text('4729', 'V2Mono'), icon('check', 'color.signal.dot')], { gap: 'space.tight', align: 'center' }),
  ], { w: 'fill', align: 'center', gap: 'space.item', pad: { block: 'space.group' } })
  const ruler = row('Clock ruler', Array.from({ length: 31 }, (_, k) => ({ shape: `Ruler tick ${k + 1}`, kind: 'rect', size: ['size.stroke', k === 21 ? 20 : k % 5 === 0 ? 12 : 6],
    fill: k === 21 ? 'color.surface.inverse' : 'color.border.ring' })), { w: 'fill', justify: 'between', align: 'end' })
  const clock = col('Clock', [
    text('14:22', 'V2Num', { name: 'Clock value' }),
    text('1 Ramadan 1447 AH · Asia/Riyadh', 'V2Small', { color: 'color.text.soft', name: 'Clock date' }),
    ruler,
  ], { w: 'fill', align: 'center', gap: 'space.snug', pad: { block: 'space.group' } })
  return tileBox('Format tile', [otp, hline('Format tile rule'), clock], { gap: 'space.none', justify: 'between' })
}

function starterTile() {
  const line = (t, hot, k) => row(`Line ${k + 1}`.replace('Line', 'Code row'), [text(t, 'V2Mono', { name: 'Code text' })],
    { w: 'fill', pad: { block: 2, inline: 'space.tight' }, ...(hot ? { fill: 'color.surface.highlight' } : {}) })
  const pane = (title, body) => col(`${title} pane`, [
    row(`${title} head`, [text(title, 'V2Mono', { color: 'color.text.faint', name: 'Pane title' })], { w: 'fill', pad: { block: 'space.tight', inline: 'space.snug' } }),
    hline(`${title} rule`),
    body,
  ], { w: 'fill', h: 'fill', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE, clip: true })
  const code = (name, lines, hot) => col(name, lines.map((t, k) => line(t, hot.includes(k), k)), { w: 'fill', gap: 2, pad: 'space.tight' })
  const card = col('Mini card', [
    row('Mini head', [{ shape: 'Mini avatar', kind: 'ellipse', size: [14, 14], fill: 'color.surface.panel' }, { shape: 'Mini title', kind: 'rect', size: [56, 6], fill: 'color.surface.panel' }], { w: 'fill', gap: 'space.tight', align: 'center', justify: 'end' }),
    { shape: 'Mini amount', kind: 'rect', size: [80, 10], fill: 'color.text.primary' },
    { shape: 'Mini line', kind: 'rect', size: [96, 6], fill: 'color.surface.panel' },
    row('Mini button', [], { w: 'fill', h: 18, radius: 'radius.pill', fill: 'color.surface.inverse' }),
  ], { w: 140, gap: 'space.tight', pad: 'space.snug', radius: 'radius.card', fill: 'color.surface.page', stroke: { color: 'color.border.select', width: 'size.stroke' }, align: 'end' })
  const canvas = col('Canvas', [text('Card · RTL', 'V2Mono', { color: 'color.text.soft', name: 'Frame tag' }), card],
    { w: 'fill', h: 'fill', gap: 'space.hair', justify: 'center', align: 'center', fill: 'color.surface.raised' })
  return tileBox('Starter tile', [row('Mini pipeline', [
    pane('tokens.json', code('Tokens', ['{', '  "radius": {', '    "card": 24', '  },', '  "dir": "rtl"', '}'], [2, 4])),
    pane('Figma', canvas),
    pane('Code', code('JSX', ['<Card dir="rtl">', '  <Amount />', '  <Pay />', '</Card>', '', 'radius: 24px'], [0, 5])),
  ], { w: 'fill', h: 'fill', gap: 'space.snug' })], { w: 'fill', h: 'size.v2.pipe', fill: 'color.surface.raised' })
}

function points(list, name) {
  return col(`${name} points`, list.map(([title, line], k) => col(`${name} point ${k + 1}`, [
    hline(`${name} point rule ${k + 1}`),
    col(`${name} point text ${k + 1}`, [text(title, 'V2Label', { name: 'Point title' }), text(line, 'V2Body', { color: 'color.text.soft', w: 'fill', name: 'Point line' })], { w: 'fill', gap: 'space.hair', pad: { block: 'space.item' } }),
  ], { w: 'fill' })), { w: 'fill' })
}

function headBlock(p) {
  return col(`${p.name} heading block`, [
    ...(p.tag ? [row('Tag', [text(p.tag, 'V2Small', { color: 'color.text.soft' })], { pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', stroke: LINE })] : []),
    text(p.heading, 'V2H2', { name: 'Heading' }),
  ], { w: 'fill', gap: 'space.item' })
}

export function formatSection(p, tile) {
  return band(p.name, [row(`${p.name} row`, [
    tile,
    col(`${p.name} copy`, [headBlock(p), text(p.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }), points(p.points, p.name)], { w: 'size.v2.half', gap: 'space.group' }),
  ], { w: 'fill', justify: 'between', align: 'center' })], { pad: { top: 'space.v2.section' } })
}

function starterSection(p, tile) {
  return band(p.name, [
    col(`${p.name} header`, [
      row('Tag', [text(p.tag, 'V2Small', { color: 'color.text.soft' })], { pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', stroke: LINE }),
      text(p.heading, 'V2H2', { align: 'center', name: 'Heading' }),
      col(`${p.name} lede wrap`, [text(p.lede, 'V2Lede', { color: 'color.text.soft', align: 'center', w: 'fill', name: 'Lede' })], { w: 'size.v2.half' }),
    ], { w: 'fill', align: 'center', gap: 'space.item' }),
    tile,
  ], { gap: 'space.v2.inner', pad: { top: 'space.v2.section' } })
}

function slider(label, rtl) {
  const thumb = row('Thumb', [icon(rtl ? 'back' : 'arrow', 'color.text.inverse')], { w: 44, h: 44, justify: 'center', align: 'center', radius: 'radius.pill', fill: 'color.surface.inverse' })
  const caption = row('Slide label', [text(label, rtl ? 'V2ArBody' : 'V2Label', { color: 'color.text.soft' })], { w: 'fill', justify: 'center' })
  return row(rtl ? 'Slide to pay · RTL' : 'Slide to pay · LTR', rtl ? [caption, thumb] : [thumb, caption],
    { w: 'fill', h: 52, align: 'center', pad: 4, radius: 'radius.pill', fill: 'color.surface.panel' })
}

export function mirror() {
  const m = V2.mirror
  return band('Mirror', [row('Mirror row', [
    row('Halftone', [], { w: 'size.v2.half', h: 'size.v2.mirror', radius: 'radius.media', stroke: LINE, fill: { type: 'image', image: 'halftone-ain', scaleMode: 'FILL' } }),
    col('Mirror copy', [
      text(m.heading, 'V2H2', { w: 'fill', name: 'Heading' }),
      text(m.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
      col('Sliders', [
        row('Slider labels', [text('Left to right', 'V2Small', { color: 'color.text.faint' }), text('Right to left', 'V2Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' }),
        slider(m.slide.en, false), slider(m.slide.ar, true),
      ], { w: 'fill', gap: 'space.snug' }),
      seg('Direction toggle', m.toggle, 1),
    ], { w: 'size.v2.half', h: 'size.v2.mirror', justify: 'end', gap: 'space.group' }),
  ], { w: 'fill', justify: 'between', align: 'start' })], { pad: { top: 'space.v2.section' } })
}

function strip() {
  const cells = V2.strip.flatMap(([n, l], k) => [
    ...(k ? [vline(`Strip rule ${k}`)] : []),
    col(`${l} cell`, [text(n, 'V2Num', { name: 'Figure' }), text(l, 'V2Small', { color: 'color.text.soft', name: 'Label' })], { w: 'fill', gap: 'space.tight', pad: { block: 'space.v2.tile', inline: 'space.block' } }),
  ])
  return band('Strip', [hline('Strip top'), row('Strip row', cells, { w: 'fill' }), hline('Strip bottom')], { pad: { top: 'space.v2.section' } })
}

export function closing() {
  const c = V2.closing
  return band('Closing', [
    text(c.heading, 'V2H2', { align: 'center', name: 'Closing headline' }),
    row('Closing actions', [pill(c.primary, { primary: true }), pill(c.secondary)], { gap: 'space.tight' }),
  ], { align: 'center', gap: 'space.block', pad: { block: 'space.v2.gap' } })
}

export function footer() {
  const f = V2.footer
  const column = ([title, links]) => col(`${title} column`, [text(title, 'V2Mono', { color: 'color.text.faint', name: 'Column title' }), ...links.map((l) => text(l, 'V2Body', { name: l }))],
    { w: 'fill', gap: 'space.snug', pad: { block: 'space.card', inline: 'space.group' } })
  const brand = col('Footer brand', [
    row('Footer brand row', [mark('Footer mark', 'color.mark.onPanel'), text('Dualkit', 'Title')], { gap: 'space.tight', align: 'center' }),
    row('Status', [{ shape: 'Status dot', kind: 'ellipse', size: ['size.dot', 'size.dot'], fill: 'color.signal.dot' }, text(f.status, 'V2Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
  ], { w: 'fill', gap: 'space.item', pad: { block: 'space.card', inline: 'space.group' } })
  const ticks = row('Ruler', Array.from({ length: 49 }, (_, k) => ({ shape: `Tick ${k + 1}`, kind: 'rect', size: ['size.stroke', k % 4 === 0 ? 12 : 6], fill: 'color.border.ring' })),
    { w: 'fill', justify: 'between', align: 'start' })
  return col('Footer', [
    band('Footer grid', [hline('Footer top'), row('Footer columns', [brand, vline('Footer rule 1'), ...f.columns.flatMap((c, k) => [...(k ? [vline(`Footer rule ${k + 1}`)] : []), column(c)])], { w: 'fill' }), hline('Footer mid')]),
    band('Footer ruler', [ticks], { pad: { top: 'space.group' } }),
    row('Wordmark', [text('Dualkit', 'V2Wordmark', { color: 'color.text.ghost', name: 'Wordmark text' })], { w: 'fill', h: 'size.v2.cell', justify: 'center', align: 'start', clip: true }),
    band('Footer legal', [row('Legal row', [text(f.legal, 'V2Small', { color: 'color.text.faint' }), text('Build for the Gulf. In both directions.', 'V2Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' })], { pad: { block: 'space.group' } }),
  ], { w: 'fill', fill: 'color.surface.panel', pad: { top: 'space.head' } })
}

export function homeV2() {
  const p = V2.parts
  return {
    screen: 'Dualkit · Home · Desktop · v2',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [nav(), hero(), stage(), skillsSection(p[0]), formatSection(p[1], formatTile()), starterSection(p[2], starterTile()), mirror(), strip(), closing(), footer()],
  }
}

/** The menu open: Product reveals a full-width drawer with three numbered hairline columns. */
export function menuV2() {
  const cellOf = ([no, name, line]) => col(`${name} entry`, [
    text(no, 'V2Mono', { color: 'color.text.faint', name: 'Number' }),
    text(name, 'V2H2', { name: 'Name' }),
    text(line, 'V2Small', { color: 'color.text.soft', w: 'fill', name: 'Line' }),
  ], { w: 'fill', gap: 'space.snug', pad: { block: 'space.card', inline: 'space.group' } })
  const drawer = col('Drawer', [
    band('Drawer grid', [row('Drawer columns', V2.drawer.flatMap((d, k) => [...(k ? [vline(`Drawer rule ${k}`)] : []), cellOf(d)]), { w: 'fill' })]),
    hline('Drawer rule'),
  ], { w: 'fill', fill: 'color.surface.page' })
  return {
    screen: 'Dualkit · Menu open · Desktop · v2',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [nav(), drawer, row('Scrim', [], { w: 'fill', h: 'size.v2.cell', fill: 'color.surface.panel' })],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'home-v2-desktop.json'), JSON.stringify(homeV2(), null, 2) + '\n')
  writeFileSync(resolve(SPECS, 'menu-v2-desktop.json'), JSON.stringify(menuV2(), null, 2) + '\n')
  console.log('specs written')
}
