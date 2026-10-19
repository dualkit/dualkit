// dualkit.dev home and Products menu at phone width (390), built from the same parts as the desktop frames.
// Rules: 16 px gutter, display 40, H2 32, sections 120 apart, hero painting 4:5 with the caption rail under it,
// the map cropped to the Gulf with its cities listed under it, the video full width above its words, footer columns two by two.
// Run: node gen/v3/mobile.mjs, which writes specs/home-v3-phone.json and specs/menu-v3-phone.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { V3 } from './copy.mjs'
import { panel as builtPanel } from './hero-graphic.mjs'
import { benchDot, benchTrack, checkMedia, connectMedia, kitClosed, kitOpen, makerSvgFor, rankMedia, skillsPanel, slider } from './home.mjs'
import { MENU, partRow } from './menu.mjs'
import { FORMATS, MAP, S, seal, socials } from './sections.mjs'
import { GLASS_LINE, LINE, button, col, frame, glass, gsoft, gtext, hline, icon, label, mark, painting, row, square, text, vline } from './parts.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const PHONE = 390 // no size token for the phone width; raw on purpose
const GUTTER = 'space.item'
// Desktop line breaks that leave a one-word line at 32 px; same words, phone breaks.
const PHONE_BREAKS = { 'Open source, tested,\nand checked every month.': 'Open source, tested,\nand checked\nevery month.' }
const SECTION = 'space.120'
const CONTENT = PHONE - 32
const INNER = CONTENT - 32 // a frame's content after its 16 px cell padding

/** A gutter band: the phone's version of the desktop's centred 1200 column. */
const pband = (name, children, { pad = {}, ...extra } = {}) => col(name, children, { w: 'fill', ...extra, pad: { inline: GUTTER, ...pad } })
const section = (name, children, { pad = {}, ...extra } = {}) => pband(name, children, { gap: 'space.stack', ...extra, pad: { top: SECTION, ...pad } })
const grid = (name, columns, children, extra = {}) => ({ stack: name, dir: 'grid', columns, children, w: 'fill', ...extra })

/** Section header stacked: label, headline, lede, action. */
const pheader = (name, { label: l, heading, lede, action }) => col(`${name} header`, [
  col(`${name} title`, [label(l), text(heading, 'V3H2Phone', { name: 'Heading', w: 'fill' })], { w: 'fill', gap: 'space.group' }),
  text(lede, 'V3Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
  ...(action ? [action] : []),
], { w: 'fill', gap: 'space.group' })

const lines = (glyph) => ({ shape: `${glyph} glyph`, kind: 'svg', size: [21, 21], tint: 'color.text.primary',
  svg: glyph === 'Menu'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" fill="none"><path d="M3 7.5H18M3 13.5H18" stroke="#09090b" stroke-width="1.5"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" fill="none"><path d="M5 5L16 16M16 5L5 16" stroke="#09090b" stroke-width="1.5"/></svg>' })

export function phoneNav(open = false) {
  return col('Nav', [
    row('Nav row', [
      row('Brand', [mark(), text('Dualkit', 'V3Label')], { gap: 'space.tight', align: 'center' }),
      row('Nav end', [button(V3.nav.cta), row(open ? 'Close button' : 'Menu button', [lines(open ? 'Close' : 'Menu')], { pad: 'space.snug', stroke: LINE })], { gap: 'space.tight', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug', inline: GUTTER } }),
    hline('Nav rule'),
  ], { w: 'fill' })
}

// Hero: the settled frame of the approved animation, the caption rail under the painting.
function rail() {
  const tick = (k) => square(`Rail tick ${k + 1}`, 8, 'color.v3.tick')
  return col('Caption rail', [
    row('Rail head', [text('06', 'V3Mono', { color: 'color.text.soft', name: 'Chapter' }), text('Checked', 'V3Lede', { name: 'Rail title' })], { gap: 'space.snug', align: 'baseline' }),
    text('Every rule passes. Same screen, both directions.', 'V3Small', { color: 'color.text.soft', w: 'fill', name: 'Rail line' }),
    row('Rail ticks', Array.from({ length: 6 }, (_, k) => tick(k)), { gap: 'space.tight', pad: { top: 'space.tight' } }),
  ], { w: 'fill', gap: 'space.tight' })
}

function hero() {
  const h = V3.hero
  return col('Hero', [
    pband('Hero head', [
      col('Hero title', [label(h.label), text(h.headline, 'V3DisplayPhone', { name: 'Headline', w: 'fill' })], { w: 'fill', gap: 'space.group' }),
      text(h.lede, 'V3Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
      row('Hero actions', [button(h.primary, 'ink', 'arrow'), button(h.secondary, 'outline')], { gap: 'space.tight' }),
    ], { gap: 'space.group', pad: { top: 'space.head' } }),
    pband('Hero media', [frame('Hero frame', [
      painting('Hero painting', [builtPanel(7, { w: 296, note: false })], { h: Math.round((CONTENT - 24) * 5 / 4) }),
      rail(),
    ], { dir: 'col', gap: 'space.item', pad: 'space.snug' })]),
  ], { w: 'fill', gap: 'space.stack' })
}

function statement() {
  return pband('Statement', [col('Statement lines', S.statement.map(([t, read], k) => text(t, 'V3DisplayPhone', { color: read ? 'color.text.primary' : 'color.text.ghost', w: 'fill', name: `Statement line ${k + 1}` })), { w: 'fill', gap: 'space.hair' })],
    { h: 640, justify: 'center', pad: { top: SECTION } })
}

function how() {
  const p = V3.how
  const media = [connectMedia(), rankMedia(), checkMedia()]
  const cell = ([no, title, body], k) => col(`Step ${no}`, [
    painting(`Step ${no} painting`, [media[k]], { h: 240 }),
    col(`Step ${no} text`, [text(no, 'V3Small', { color: 'color.text.faint', name: 'Number' }), text(title, 'V3Step', { name: 'Title' }), text(body, 'V3Body', { color: 'color.text.soft', w: 'fill', name: 'Body' })], { w: 'fill', gap: 'space.tight' }),
  ], { w: 'fill', gap: 'space.group', pad: 'space.item' })
  return section('How', [pheader('How', p), frame('How frame', p.steps.flatMap((s, k) => [...(k ? [hline(`How rule ${k}`)] : []), cell(s, k)]), { dir: 'col' })])
}

// The Gulf, cropped from the desktop map; each city a numbered point, listed under the map.
const CROP = { x: 230, y: 110, w: 1100, h: 560 }
const PITCH = 5
/** Re-grid the desktop dot matrix at phone scale, so the dots stay 2 px instead of shrinking to a blur. */
function regrid(path, k) {
  const seen = new Set()
  for (const [, x, y] of path.matchAll(/M([\d.]+) ([\d.]+)/g)) {
    const gx = Math.round(((+x - CROP.x) * k) / PITCH), gy = Math.round(((+y - CROP.y) * k) / PITCH)
    if (gx >= 0 && gy >= 0 && gx * PITCH < PHONE && gy * PITCH < CROP.h * k) seen.add(`${gx},${gy}`)
  }
  return [...seen].map((g) => { const [gx, gy] = g.split(','); return `M${gx * PITCH} ${gy * PITCH}h2v2h-2z` }).join('')
}
function region() {
  const r = S.region
  const k = PHONE / CROP.w
  const H = Math.round(CROP.h * k)
  const at = ([x, y]) => [(x - CROP.x) * k, (y - CROP.y) * k]
  const cities = Object.entries(MAP.cities)
  const [hx, hy] = at(MAP.cities.Dubai)
  const dots = { shape: 'Land', kind: 'svg', size: [PHONE, H], abs: { start: 0, top: 0 }, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PHONE} ${H}"><path fill="#09090b" fill-opacity=".3" d="${regrid(MAP.path, k)}"/><path fill="#09090b" fill-opacity=".6" d="${regrid(MAP.lit, k)}"/></svg>` }
  const arcs = { shape: 'Arcs', kind: 'svg', size: [PHONE, H], abs: { start: 0, top: 0 }, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PHONE} ${H}" fill="none">${cities.filter(([c]) => c !== 'Dubai').map(([, p]) => { const [x, y] = at(p); return `<path d="M${hx.toFixed(1)} ${hy.toFixed(1)}Q${((hx + x) / 2).toFixed(1)} ${(Math.min(hy, y) - 28).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}" stroke="#09090b" stroke-opacity=".4" stroke-width="1"/>` }).join('')}</svg>` }
  const pins = cities.flatMap(([city, p], n) => {
    const [x, y] = at(p).map(Math.round)
    return [
      { ...square(`${city} point`, 6), abs: { start: x - 3, top: y - 3 } },
      row(`${city} number`, [text(String(n + 1), 'V3Small', { name: 'Number' })], { abs: { start: x + 7, top: y - 10 } }),
    ]
  })
  const item = ([city], n) => row(`${city} item`, [
    row(`${city} name`, [text(String(n + 1), 'V3Small', { color: 'color.text.faint', name: 'Number' }), text(city, 'V3Label', { name: 'City' })], { gap: 'space.item', align: 'center' }),
    text(FORMATS[city], 'V3Small', { color: 'color.text.soft', name: 'Format' }),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug' } })
  return col('Region', [
    pband('Region head', [pheader('Region', r)], { pad: { top: SECTION } }),
    col('Map', [dots, arcs, ...pins], { w: PHONE, h: H, clip: true }),
    pband('City list', cities.flatMap((c, n) => [hline(`City rule ${n + 1}`), item(c, n)])),
  ], { w: 'fill', gap: 'space.stack' })
}

function kit() {
  const p = V3.kit
  return section('Kit', [pheader('Kit', p), frame('Kit frame', [
    kitOpen('space.item', true),
    painting('Kit painting', [skillsPanel(300)], { pad: { block: 'space.card' } }),
    ...p.rest.flatMap((n, k) => [hline(`Kit rule ${k + 1}`), kitClosed(n, k, 'space.item')]),
  ], { dir: 'col' })])
}

function works() {
  const p = V3.works
  const tile = ([name, role]) => col(`${name} tile`, [
    row(`${name} glyph box`, [{ shape: `${name} mark`, kind: 'svg', size: [18, 18], svg: worksSvg(name), tint: 'color.text.primary' }], { w: 40, h: 40, justify: 'center', align: 'center', stroke: LINE }),
    col(`${name} words`, [text(name, 'V3Label', { name: 'Name' }), text(role, 'V3Small', { color: 'color.text.faint', name: 'Role' })]),
  ], { w: 'fill', gap: 'space.group', pad: 'space.item' })
  const ask = col('Ask tile', [
    row('Ask box', [text('+', 'V3Label', { color: 'color.text.faint' })], { w: 40, h: 40, justify: 'center', align: 'center', stroke: { ...LINE, dash: [3, 3] } }),
    col('Ask words', [text(p.ask[0], 'V3Label', { color: 'color.text.soft' }), text(p.ask[1], 'V3Small', { color: 'color.text.faint' })]),
  ], { w: 'fill', gap: 'space.group', pad: 'space.item' })
  const cells = [...p.tools.map(tile), ask]
  const pairs = [0, 2, 4].map((i, k) => row(`Works row ${k + 1}`, [cells[i], vline(`Works split ${k + 1}`), cells[i + 1]], { w: 'fill' }))
  return section('Works', [pheader('Works', { ...p, action: button(p.action, 'ink', 'arrow') }),
    frame('Works frame', pairs.flatMap((r, k) => [...(k ? [hline(`Works rule ${k}`)] : []), r]), { dir: 'col', joins: [CONTENT / 2] })])
}

function video() {
  const v = S.video
  const chip = glass('Video chip', [row('Video chip row', [square('Video chip square', 6, 'color.signal.dot'), text('dualkit check', 'V3Mono', { color: 'color.v3.glassText' }), gsoft('0 rules failing')], { gap: 'space.snug', align: 'center' })],
    { pad: { block: 'space.snug', inline: 'space.item' }, abs: { start: 16, bottom: 16 } })
  return col('Video', [
    col('Video frame', [chip], { w: 'fill', h: Math.round(PHONE * 5 / 4), clip: true, fill: { type: 'image', image: 'video', scaleMode: 'FILL' } }),
    pband('Video words', [label(v.label), text(v.heading, 'V3DisplayPhone', { name: 'Heading', w: 'fill' }), text(v.lede, 'V3Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }), button(v.action, 'ink', 'arrow')], { gap: 'space.group' }),
  ], { w: 'fill', gap: 'space.card', pad: { top: SECTION } })
}

function mirror() {
  const p = V3.mirror
  const cell = (dir, k) => col(`${p.captions[k]} cell`, [
    painting(`${p.captions[k]} painting`, [slider(dir, 280)], { h: 200 }),
    row(`${p.captions[k]} caption`, [text(p.captions[k], 'V3Label'), text(`dir="${dir}"`, 'V3Mono', { color: 'color.text.faint' })], { w: 'fill', justify: 'between' }),
  ], { w: 'fill', gap: 'space.item', pad: 'space.item' })
  return section('Mirror', [pheader('Mirror', p), frame('Mirror frame', [cell('ltr', 0), hline('Mirror rule'), cell('rtl', 1)], { dir: 'col' })])
}

function bench() {
  const p = V3.bench
  const r = ([name, m, a, d], k) => col(`${name} row`, [
    row(`${name} head`, [
      row(`${name} name`, [text(String(k + 1), 'V3Small', { color: 'color.text.faint' }), { shape: `${name} maker`, kind: 'svg', size: [16, 16], svg: makerSvgFor(m), tint: 'color.text.primary' }, text(name, 'V3Label')], { gap: 'space.snug', align: 'center' }),
      row(`${name} figures`, [text(`${a}`, 'V3Small', { color: 'color.text.faint' }), text(`${d}`, 'V3Label'), text(`+${d - a}`, 'V3Mono')], { gap: 'space.snug', align: 'center' }),
    ], { w: 'fill', justify: 'between', align: 'center' }),
    benchTrack(a, d, INNER),
  ], { w: 'fill', gap: 'space.snug', pad: 'space.item' })
  const legend = col('Legend', [
    row('Legend keys', [
      row('Legend alone', [benchDot('Legend alone dot', false), text('Alone', 'V3Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
      row('Legend dualkit', [benchDot('Legend dualkit dot', true), text('With Dualkit', 'V3Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    ], { gap: 'space.group', align: 'center' }),
    text('Sample data until 1 November', 'V3Small', { color: 'color.text.faint' }),
  ], { w: 'fill', gap: 'space.tight', pad: 'space.item' })
  return section('Bench', [pheader('Bench', { ...p, action: button(p.action, 'outline', 'arrow') }),
    frame('Bench frame', [legend, ...p.rows.flatMap((x, k) => [hline(`Bench rule ${k + 1}`), r(x, k)])], { dir: 'col' })])
}

function numbers() {
  const n = S.numbers
  const cell = ([num, what]) => col(`${what} stat`, [text(num, 'V3DisplayPhone', { name: 'Number' }), text(what, 'V3Body', { color: 'color.text.soft', w: 'fill', name: 'What' })], { w: 'fill', gap: 'space.tight', pad: 'space.item' })
  const pairs = [0, 2].map((i, k) => row(`Numbers row ${k + 1}`, [cell(n.stats[i]), vline(`Numbers split ${k + 1}`), cell(n.stats[i + 1])], { w: 'fill' }))
  return section('Numbers', [
    col('Numbers title', [label(n.label), text(PHONE_BREAKS[n.heading] ?? n.heading, 'V3H2Phone', { name: 'Heading', w: 'fill' })], { w: 'fill', gap: 'space.group' }),
    frame('Numbers frame', [pairs[0], hline('Numbers rule'), pairs[1]], { dir: 'col', joins: [CONTENT / 2] }),
  ])
}

function closing() {
  const c = V3.closing
  const command = row('Command', [text(c.command, 'V3Mono', { color: 'color.v3.glassText', w: 'fill' }), icon('copy', 'color.v3.glassSoft', 14)], { w: 'fill', align: 'center', pad: { block: 'space.snug', inline: 'space.snug' }, stroke: GLASS_LINE })
  const box = glass('Closing panel', [
    text(c.heading, 'V3H2Phone', { color: 'color.v3.glassText', w: 'fill', name: 'Heading' }),
    command,
    row('Closing actions', [row('Get started button', [text(c.primary, 'V3Label'), icon('arrow', 'color.text.primary', 14)], { gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.group' }, fill: 'color.v3.glassButton' }),
      row('Docs button', [gtext(c.secondary, 'V3Label')], { pad: { block: 'space.snug', inline: 'space.group' }, stroke: GLASS_LINE })], { gap: 'space.tight' }),
  ], { w: CONTENT - 32, gap: 'space.group', pad: 'space.item' })
  return section('Closing', [frame('Closing frame', [painting('Closing painting', [box], { h: 520 })])])
}

function footer() {
  const f = S.footer
  const column = ([title, links]) => col(`${title} column`, [text(title, 'V3Label', { name: 'Column title' }), ...links.map((l) => text(l, 'V3Body', { color: 'color.text.soft', name: l }))], { w: 'fill', h: 'fill', gap: 'space.snug' })
  return col('Footer', [
    pband('Footer top', [
      col('Footer brand', [row('Footer brand row', [mark('Footer mark'), text('Dualkit', 'V3Step')], { gap: 'space.snug', align: 'center' }),
        text(f.line, 'V3Body', { color: 'color.text.soft', w: 'fill' }), socials()], { w: 'fill', gap: 'space.group' }),
      grid('Link columns', 2, f.columns.map(column), { gap: 'space.block' }),
      col('Seals block', [grid('Seals', 3, S.seals.map((s) => ({ ...seal(s), w: 'fill', h: 'fill' })), { gap: 'space.group' }),
        text(S.sealNote, 'V3Small', { color: 'color.text.faint', w: 'fill' })], { w: 'fill', gap: 'space.group' }),
      hline('Footer rule'),
      col('Legal', [text(f.legal, 'V3Small', { color: 'color.text.soft' }), row('Made by', [text('Made by', 'V3Small', { color: 'color.text.soft' }), text('Sam Santos', 'V3Small', { name: 'Maker link' }), { shape: 'Mascot', kind: 'ellipse', size: [18, 18], fill: 'color.surface.inverse' }], { gap: 'space.tight', align: 'center' })],
        { w: 'fill', gap: 'space.tight' }),
    ], { gap: 'space.card' }),
    row('Footer painting', [text('Dualkit', 'V3WordmarkPhone', { color: 'color.v3.glassText', name: 'Wordmark' })], { w: 'fill', h: 240, justify: 'center', align: 'end', clip: true, fill: { type: 'image', image: 'footer', scaleMode: 'FILL' } }),
  ], { w: 'fill', gap: 'space.v2.inner', pad: { top: SECTION } })
}

const marksTs = readFileSync(resolve(import.meta.dirname, '../../../../apps/site/lib/marks.ts'), 'utf8')
const worksSvg = (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="${marksTs.match(new RegExp(`name: '${name.replace('.', '\\.')}',[^}]*?path: '([^']+)'`))[1]}"/></svg>`

export function homePhone() {
  return {
    screen: 'Dualkit · Home · Phone · v3',
    size: [PHONE, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary',
    children: [phoneNav(), hero(), statement(), how(), region(), kit(), works(), video(), mirror(), bench(), numbers(), closing(), footer()],
  }
}

// The Products menu on a phone: a full-screen sheet under the nav. No hover preview, so the list leads and the install line follows.
export function menuPhone() {
  const m = MENU
  const command = row('Install line', [text('$', 'V3Mono', { color: 'color.text.faint' }), text(m.command, 'V3Mono', { w: 'fill' }), icon('copy', 'color.text.soft', 14)],
    { w: 'fill', gap: 'space.snug', align: 'center', pad: { block: 'space.snug', inline: 'space.snug' }, stroke: LINE })
  const block = (name, children) => col(name, children, { w: 'fill', gap: 'space.hair', pad: { block: 'space.group' } })
  return {
    screen: 'Dualkit · Menu open · Phone · v3',
    size: [PHONE, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.v3.ground', textColor: 'color.text.primary',
    children: [
      phoneNav(true),
      col('Menu sheet', [
        col('Parts', m.parts.flatMap((p, k) => [...(k ? [hline(`Parts rule ${k}`)] : []), partRow(p, k)]), { w: 'fill' }),
        hline('Parts end rule'),
        pband('Install', [text('Install the skills', 'V3Small', { color: 'color.text.faint' }), command], { gap: 'space.tight', pad: { block: 'space.group' } }),
        hline('Install rule'),
        pband('Side', [
          block('Start here', [text('Start here', 'V3Small', { color: 'color.text.faint' }), col('Start links', m.start.map((s) => text(s, 'V3Step', { name: s })), { gap: 'space.tight', pad: { top: 'space.tight' } })]),
          hline('Side rule 1'),
          block('Latest', [text(m.latest[0], 'V3Small', { color: 'color.text.faint' }), text(m.latest[1], 'V3Label'), text(m.latest[2], 'V3Small', { color: 'color.text.soft' })]),
          hline('Side rule 2'),
          block('Bench status', [text(m.bench[0], 'V3Small', { color: 'color.text.faint' }), row('Countdown', [square('Countdown square', 6), text(m.bench[1], 'V3Label')], { gap: 'space.tight', align: 'center' })]),
        ]),
      ], { w: 'fill', pad: { bottom: 'space.head' } }),
    ],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  writeFileSync(resolve(SPECS, 'home-v3-phone.json'), JSON.stringify(homePhone(), null, 2))
  writeFileSync(resolve(SPECS, 'menu-v3-phone.json'), JSON.stringify(menuPhone(), null, 2))
  console.log('wrote specs/home-v3-phone.json, specs/menu-v3-phone.json')
}
