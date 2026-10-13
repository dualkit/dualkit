// The Starter section, round two: four layouts side by side for Sam to compare by eye.
// Each one has a single focal object, one headline, one sentence and the install line.
// Run: node gen/v2/starter-v2.mjs, which writes specs/starter-v2-{1,2,3,4}-{desktop,mobile}.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { V2 } from './copy.mjs'
import { LINE, band, col, icon, row, text } from './parts.mjs'
import { formatSection, formatTile, mirror } from './home.mjs'
import { C, T, amount, ar, button, command, date, digits, field, ord, sheet, start, tabs, toast, toggle } from './starter-section.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export const COPY = {
  heading: 'A design system\nthat reads both ways.',
  lede: 'Eight React components on one token file. Copy them in and Arabic works from the first commit.',
  toggle: ['English', 'العربية'],
  checkout: { En: 'Checkout', Ar: 'الدفع' },
  big: 'Built to read\nboth ways.',
  mobileHeading: 'A design system\nthat reads\nboth ways.',
}

const PAINTING = { type: 'image', image: 'dunes', scaleMode: 'FILL' }

// The one screen every layout shows: a checkout built from the approved Starter components.
function checkout(s, { phone = false, withDate = true } = {}) {
  const head = text(COPY.checkout[s], ar(s) ? 'V2ArTitle' : 'Title', { name: 'Screen title' })
  const pay = row('Pay row', [button(s, C.pay[s])], { w: 'fill', justify: ar(s) ? 'start' : 'end' })
  return col(`Checkout ${s}`, [head, amount(s), ...(withDate ? [date(s)] : []), field(s), digits(s, true), pay],
    { w: 'fill', ...(phone ? { h: 'fill' } : {}), gap: 'space.group', align: start(s) })
}

function header(mobile) {
  const copy = col('Starter copy', [
    text(mobile ? COPY.mobileHeading : COPY.heading, 'V2H2', { name: 'Heading', ...(mobile ? { w: 'fill' } : {}) }),
    text(COPY.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
  ], { w: mobile ? 'fill' : 'size.v2.half', gap: 'space.group' })
  if (mobile) return col('Starter header', [copy, command('fill')], { w: 'fill', gap: 'space.block' })
  return row('Starter header', [copy, command()], { w: 'fill', justify: 'between', align: 'end' })
}

const dots = () => row('Traffic lights', [0, 1, 2].map((k) => ({ shape: `Light ${k + 1}`, kind: 'ellipse', size: ['size.v2.dot', 'size.v2.dot'], fill: 'color.surface.panel' })), { gap: 'space.tight' })

function appWindow(s, w) {
  const bar = row('Title bar', [dots()], { w: 'fill', align: 'center', pad: { block: 'space.snug', inline: 'space.item' } })
  return col('App window', [bar, row('Window rule', [], { w: 'fill', h: 'size.stroke', fill: 'color.border.grid' }),
    col('Window body', [checkout(s, { withDate: false })], { w: 'fill', pad: { block: 'space.card', inline: 'space.card' } })],
    { w, radius: 'radius.window', fill: 'color.surface.page', stroke: LINE, clip: true })
}

function phone(s, w = 320, h = 660, withDate = true) {
  return col(`Phone ${s}`, [checkout(s, { phone: true, withDate })], {
    w, h, pad: { top: 'space.stack', bottom: 'space.card', inline: 'space.group' }, radius: 40, fill: 'color.surface.page', stroke: LINE, clip: true,
  })
}

const painting = (name, children, extra = {}) => col(name, children, { w: 'fill', justify: 'center', align: 'center', radius: 'radius.media', clip: true, fill: PAINTING, ...extra })

// 1. One app on a painting, flipped by one switch.
function one(mobile) {
  const stage = painting('Painting', [toggle(COPY.toggle, 1), appWindow('Ar', mobile ? 'fill' : 480)],
    { h: mobile ? 'hug' : 'size.v2.stage', gap: 'space.group', pad: mobile ? { block: 'space.card', inline: 'space.item' } : 'space.none' })
  return [header(mobile), stage]
}

// 2. The same checkout as two phones, English and Arabic, mirrored.
function two(mobile) {
  const phones = mobile
    ? col('Phones', [phone('En', 'fill', 560, false), phone('Ar', 'fill', 560, false)], { w: 'fill', gap: 'space.item' })
    : row('Phones', [phone('En'), phone('Ar')], { gap: 'space.card', align: 'center' })
  const stage = painting('Painting', [phones], { h: mobile ? 'hug' : 'size.v2.stage', pad: mobile ? { block: 'space.card', inline: 'space.item' } : 'space.none' })
  return [header(mobile), stage]
}

// 3. Big type beside one phone that flips.
function three(mobile) {
  const copy = col('Starter copy', [
    text(mobile ? COPY.mobileHeading : COPY.big, mobile ? 'V2H2' : 'V2Hero', { name: 'Heading', w: 'fill' }),
    text(COPY.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
    command(mobile ? 'fill' : 'hug'),
  ], { w: mobile ? 'fill' : 'size.v2.half', gap: 'space.block' })
  const stage = painting('Painting', [phone('Ar', 320, 560, false), toggle(COPY.toggle, 1)],
    { w: mobile ? 'fill' : 'size.v2.half', h: mobile ? 'hug' : 'size.v2.stage', gap: 'space.group', pad: mobile ? { block: 'space.card' } : 'space.none' })
  if (mobile) return [copy, stage]
  return [row('Starter row', [copy, stage], { w: 'fill', justify: 'between', align: 'center' })]
}

// 4. A grid of large tiles, one component each; hovering a tile flips its language.
function sheetMini(s) {
  const pair = ([k, v], i) => row(`Sheet row ${i + 1}`, ord(s, [text(k, T(s).small, { color: 'color.text.soft', name: 'Key' }), text(v, 'V2Mono', { name: 'Value' })]), { w: 'fill', justify: 'between', align: 'center' })
  return col(`Sheet ${s}`, [
    text(C.sheet[s], T(s).title, { name: 'Title' }),
    col('Sheet rows', C.rows[s].map(pair), { w: 'fill', gap: 'space.tight' }),
    row('Sheet actions', [button(s, C.pay[s])], { w: 'fill', justify: ar(s) ? 'start' : 'end' }),
  ], { w: 'fill', gap: 'space.item', pad: 'space.item', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })
}

function toastMini(s) {
  const msg = { En: 'Payment sent.', Ar: 'تم الدفع.' }
  return row(`Toast ${s}`, ord(s, [
    row('Toast message', ord(s, [icon('check', 'color.text.inverse'), text(msg[s], T(s).body, { color: 'color.text.inverse', name: 'Message' })]), { gap: 'space.snug', align: 'center' }),
    text(C.undo[s], T(s).label, { color: 'color.text.inverse', name: 'Undo' }),
  ]), { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.snug', inline: 'space.item' }, radius: 'radius.media', fill: 'color.surface.inverse' })
}

const TILES = [
  ['Button', 'En', (s) => button(s, C.next[s])],
  ['Field', 'Ar', (s) => field(s)],
  ['Digit input', 'En', (s) => digits(s, true)],
  ['Amount', 'Ar', amount],
  ['Date', 'Ar', date],
  ['Tabs', 'Ar', tabs],
  ['Sheet', 'En', sheetMini],
  ['Toast', 'Ar', toastMini],
]

function tile([name, s, build], mobile) {
  return col(`${name} tile`, [
    col(`${name} stage`, [build(s)], { w: 'fill', h: mobile ? 'hug' : 200, ...(mobile ? { pad: { block: 'space.block' } } : {}), justify: 'center', align: 'center' }),
    text(name, 'V2Label', { name: 'Name', color: 'color.text.soft' }),
  ], { w: 'fill', h: mobile ? 'hug' : 'fill', gap: 'space.item', pad: 'space.group', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })
}

function four(mobile) {
  const tiles = TILES.map((t) => tile(t, mobile))
  const grid = mobile
    ? col('Tiles', tiles, { w: 'fill', gap: 'space.tight' })
    : { stack: 'Tiles', dir: 'grid', columns: 4, gap: 'space.tight', w: 'fill', children: tiles }
  return [header(mobile), grid]
}

const LAYOUTS = { 1: ['One app on a painting', one], 2: ['Two phones, EN and AR', two], 3: ['One phone, big type', three], 4: ['Component tiles', four] }

export function desktop(key) {
  const [name, build] = LAYOUTS[key]
  const p = V2.parts
  return {
    screen: `Dualkit · Starter section · v2 · ${key} ${name} · Desktop`,
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [formatSection(p[1], formatTile()), band('Starter', build(false), { gap: 'space.v2.inner', pad: { top: 'space.v2.section' } }), mirror()],
  }
}

export function mobile(key) {
  const [name, build] = LAYOUTS[key]
  return {
    screen: `Dualkit · Starter section · v2 · ${key} ${name} · Mobile`,
    size: [390, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    pad: { block: 120, inline: 'space.item' }, gap: 'space.stack',
    children: build(true),
  }
}

mkdirSync(SPECS, { recursive: true })
for (const key of Object.keys(LAYOUTS)) {
  writeFileSync(resolve(SPECS, `starter-v2-${key}-desktop.json`), JSON.stringify(desktop(key), null, 2) + '\n')
  writeFileSync(resolve(SPECS, `starter-v2-${key}-mobile.json`), JSON.stringify(mobile(key), null, 2) + '\n')
}
console.log('specs written')
