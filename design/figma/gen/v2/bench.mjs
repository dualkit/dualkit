// The /bench page: a monthly leaderboard of free AI models building Arabic screens, alone and with Dualkit.
// Two leaderboard directions for Sam to pick from (A tick table, B range track), plus the open row and the empty state.
// Run: node gen/v2/bench.mjs, which writes specs/bench-*.json. All numbers are sample data until the first run.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LINE, band, col, hline, icon, pill, row, text, vline } from './parts.mjs'
import { footer, nav } from './home.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export const BENCH = {
  headline: 'How well does AI\nbuild Arabic?',
  lede: 'Every month, free AI models build five Arabic screens on their own, then again with Dualkit. dualkit check scores every build against 20 rules.',
  month: 'October 2026',
  facts: '6 models · 5 screens · 180 builds',
  raw: 'Raw files on GitHub',
  prompts: 'Read the prompts',
  columns: ['Model', 'Alone', 'With Dualkit', 'Lift', 'Check score'],
  models: [
    { label: 'Gemini Flash', by: 'Google', alone: 61, dualkit: 92, score: [18, 74] },
    { label: 'Gemma 4 31B', by: 'Google', alone: 54, dualkit: 88, score: [9, 66] },
    { label: 'Nemotron 3 Ultra', by: 'NVIDIA', alone: 58, dualkit: 85, score: [12, 61] },
    { label: 'Inkling', by: 'Thinking Machines', alone: 49, dualkit: 81, score: [4, 55], isNew: true },
    { label: 'Laguna S 2.1', by: 'Poolside', alone: 42, dualkit: 71, score: [0, 41] },
    { label: 'North Mini Code', by: 'Cohere', missing: 'Fewer than two of three runs came back on three screens.' },
  ],
  how: {
    heading: 'How the Bench works',
    items: [
      ['Five screens', 'A payment summary, a one-time code, an address form, a profile and an order history. Every prompt is public.'],
      ['Three runs, two ways', 'Each model builds each screen three times on its own, then three times with the Dualkit skills loaded. The middle run counts.'],
      ['Scored by dualkit check', 'The same 20 rules you can run with npx dualkit check. A build that leaves out a part the prompt asked for scores 0.'],
      ['A small sample', 'Free models only, run once a month. A model that fails shows as didn’t run, never as a guess.'],
    ],
  },
  screens: [
    ['Payment summary', 14, 20],
    ['One-time code', 12, 19],
    ['Address form', 11, 18],
    ['Profile', 13, 18],
    ['Order history', 11, 17],
  ],
  empty: {
    heading: 'The first run lands on 1 November.',
    lede: 'Six free models, five screens, three runs each. The results and every raw file go up here the same day.',
  },
}

// The six rules the sample alone build fails, as dualkit check reports them.
const FINDINGS = [
  ['An Arabic page without dir="rtl"', 'Set dir="rtl" on <html> whenever lang is Arabic.'],
  ['Arabic laid out left to right', 'Set dir="rtl" on the page or the element, and lang="ar".'],
  ['Letter-spacing on Arabic', 'Set letter-spacing: 0 on Arabic.'],
  ['Punctuation at the wrong end', 'Give the block the direction of its own text.'],
  ['No Arabic font in the stack', 'Add an Arabic family, for example IBM Plex Sans Arabic.'],
  ['Arabic set too small', 'Keep Arabic UI text at 14px or more.'],
]

const box = { radius: 'radius.media', fill: 'color.surface.page', stroke: LINE }
const MODEL_W = 280
const LIFT_W = 120
const SCORE_W = 160
const TICKS = 25

// ---- shared pieces ----

function ticks(name, total, filled, on = 'color.surface.inverse') {
  return row(name, Array.from({ length: total }, (_, k) => ({ shape: `${name} tick ${k + 1}`, kind: 'rect', size: [3, 14],
    fill: k < filled ? on : 'color.surface.panel' })), { w: 'fill', justify: 'between', align: 'center' })
}

const tag = (label) => row(`${label} tag`, [text(label, 'V2Small', { color: 'color.text.soft' })], { pad: { block: 0, inline: 'space.tight' }, radius: 'radius.pill', stroke: LINE })

function modelCell(m, w = MODEL_W) {
  return col(`${m.label} name`, [
    row('Name row', [text(m.label, 'V2Label', { name: 'Model' }), ...(m.isNew ? [tag('New')] : [])], { gap: 'space.tight', align: 'center' }),
    text(m.by, 'V2Small', { color: 'color.text.faint', name: 'Maker' }),
  ], { w })
}

const lift = (m) => text(`+${m.dualkit - m.alone}`, 'V2H2', { name: 'Lift' })
const scorePair = (m) => col('Check score', [text(`${m.score[0]} → ${m.score[1]}`, 'V2Label', { name: 'Score' }), text('out of 100', 'V2Small', { color: 'color.text.faint' })], { w: SCORE_W })

function monthPicker() {
  return row('Month picker', [text(BENCH.month, 'V2Label'), icon('chevron', 'color.text.soft', 12)],
    { gap: 'space.tight', align: 'center', pad: { block: 'space.tight', inline: 'space.item' }, radius: 'radius.pill', ...box, radius: 'radius.pill' })
}

function hero(mobile = false) {
  const meta = col('Meta', [monthPicker(), text(BENCH.facts, 'V2Small', { color: 'color.text.soft', name: 'Facts' })], { gap: 'space.snug', align: mobile ? 'start' : 'end' })
  const lede = text(BENCH.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })
  const head = text(BENCH.headline, mobile ? 'V2H2' : 'V2Hero', { name: 'Headline', ...(mobile ? { w: 'fill' } : {}) })
  if (mobile) return col('Hero', [head, lede, meta], { w: 'fill', gap: 'space.group' })
  return band('Hero', [head, row('Hero row', [col('Lede wrap', [lede], { w: 'size.v2.cli.w' }), meta], { w: 'fill', justify: 'between', align: 'end' })],
    { gap: 'space.v2.inner', pad: { top: 'space.v2.hero', bottom: 'space.v2.inner' } })
}

function missingRow(m, rest) {
  return row(`${m.label} row`, [modelCell(m), col('Didn’t run', [text('Didn’t run this month', 'V2Label', { color: 'color.text.soft' }), text(m.missing, 'V2Small', { color: 'color.text.faint', w: 'fill' })], { w: 'fill', gap: 'space.hair' }), ...rest],
    { w: 'fill', gap: 'space.block', align: 'center', pad: { block: 'space.group', inline: 'space.group' } })
}

const tableOf = (rows, name = 'Leaderboard') => col(name, rows.flatMap((r, k) => [...(k ? [hline(`${name} rule ${k}`)] : []), r]), { w: 'fill', ...box })

// ---- A: tick table, the same ticks as the skills scores on the home page ----

function barCell(name, value, on) {
  return col(name, [ticks(`${name} ticks`, TICKS, Math.round(value / 4), on), text(`${value} of 100`, 'V2Small', { color: on === 'color.surface.inverse' ? 'color.text.primary' : 'color.text.soft', name: 'Value' })], { w: 'fill', gap: 'space.tight' })
}

function rowA(m) {
  if (m.missing) return missingRow(m, [])
  return row(`${m.label} row`, [modelCell(m), barCell('Alone', m.alone, 'color.border.select'), barCell('With Dualkit', m.dualkit, 'color.surface.inverse'),
    col('Lift cell', [lift(m)], { w: LIFT_W }), scorePair(m)], { w: 'fill', gap: 'space.block', align: 'center', pad: { block: 'space.group', inline: 'space.group' } })
}

function headA() {
  const [a, b, c, d, e] = BENCH.columns
  const t = (s, w) => text(s, 'V2Small', { color: 'color.text.faint', ...(w ? { w } : { w: 'fill' }), name: s })
  return row('Header', [t(a, MODEL_W), t(b), t(c), t(d, LIFT_W), t(e, SCORE_W)], { w: 'fill', gap: 'space.block', pad: { block: 'space.snug', inline: 'space.group' } })
}

// ---- B: range track, one line from the alone score to the Dualkit score ----

const TRACK = 480
const ring = (name) => row(name, [], { w: 12, h: 12, radius: 'radius.pill', fill: 'color.surface.page', stroke: { color: 'color.surface.inverse', width: 2 } })

function track(m, width = TRACK) {
  const k = width / 100
  return row('Track', [
    row('Lead', [], { w: Math.round(m.alone * k) - 6, h: 1 }),
    ring('Alone point'),
    { shape: 'Lift line', kind: 'rect', size: [Math.round((m.dualkit - m.alone) * k) - 12, 2], fill: 'color.surface.inverse' },
    { shape: 'Dualkit point', kind: 'ellipse', size: [12, 12], fill: 'color.surface.inverse' },
  ], { w: width, h: 16, align: 'center', radius: 'radius.pill', fill: 'color.surface.panel' })
}

const pair = (m) => text(`${m.alone} → ${m.dualkit}`, 'V2Label', { w: SCORE_W, name: 'Pair' })

function rowB(m) {
  if (m.missing) return missingRow(m, [])
  return row(`${m.label} row`, [modelCell(m), col('Track cell', [track(m)], { w: TRACK }), pair(m), col('Lift cell', [lift(m)], { w: LIFT_W })],
    { w: 'fill', gap: 'space.block', align: 'center', pad: { block: 'space.group', inline: 'space.group' } })
}

function headB() {
  const scale = row('Scale', ['0', '25', '50', '75', '100'].map((s) => text(s, 'V2Small', { color: 'color.text.faint', name: `Scale ${s}` })), { w: TRACK, justify: 'between' })
  const t = (s, w) => text(s, 'V2Small', { color: 'color.text.faint', w, name: s })
  return row('Header', [t('Model', MODEL_W), scale, t('Alone → with Dualkit', SCORE_W), t('Lift', LIFT_W)], { w: 'fill', gap: 'space.block', pad: { block: 'space.snug', inline: 'space.group' } })
}

function legendB() {
  return row('Legend', [
    row('Legend alone', [ring('Legend ring'), text('Alone', 'V2Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    row('Legend dualkit', [{ shape: 'Legend dot', kind: 'ellipse', size: [12, 12], fill: 'color.surface.inverse' }, text('With Dualkit', 'V2Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    text('Rules passed across five screens, out of 100', 'V2Small', { color: 'color.text.faint' }),
  ], { gap: 'space.group', align: 'center', wrap: true, w: 'fill' })
}

// ---- how it works ----

function how(mobile = false) {
  const h = BENCH.how
  const item = ([title, body]) => col(`${title} item`, [text(title, 'V2Label', { name: 'Title' }), text(body, 'V2Body', { color: 'color.text.soft', w: 'fill', name: 'Body' })], { w: 'fill', h: 'fill', gap: 'space.tight' })
  const links = row('How links', [pill(BENCH.prompts), pill(BENCH.raw, { glyph: 'arrow' })], { gap: 'space.tight', wrap: true, w: 'fill' })
  const side = col('How side', [text(h.heading, 'V2H2', { name: 'Heading', w: 'fill' }), links], { w: mobile ? 'fill' : 'size.v2.cli.w', gap: 'space.group' })
  const grid = { stack: 'How items', dir: 'grid', columns: mobile ? 1 : 2, gap: 'space.v2.tile', w: 'fill', children: h.items.map(item) }
  if (mobile) return col('How', [side, grid], { w: 'fill', gap: 'space.block' })
  return band('How', [row('How row', [side, col('How items wrap', [grid], { w: 'size.v2.half' })], { w: 'fill', justify: 'between' })], { pad: { top: 'space.v2.section', bottom: 'space.v2.section' } })
}

// ---- the open row: one model's five screens, the first one open ----

// Both builds are shown at the same zoom, over the top 300 css px of a 390 px phone, so the comparison stays fair.
const CROP = { w: 390, h: 300 }
// Rings around the sample alone build's failing boxes, from dualkit check, in css px.
const RINGS = [
  { n: ['5'], box: { x: 32, y: 11, width: 44, height: 15 } },
  { n: ['3'], box: { x: 24, y: 44, width: 98, height: 27 } },
  { n: ['6'], box: { x: 24, y: 87, width: 136, height: 14 } },
  { n: ['2', '4'], box: { x: 24, y: 112, width: 151, height: 14 } },
]
const pin = (label) => row(`Pin ${label}`, [text(label, 'V2UISmall', { color: 'color.text.inverse', name: 'Pin number' })], { w: 18, h: 18, justify: 'center', align: 'center', radius: 'radius.pill', fill: 'color.surface.inverse' })

function shot(name, image, marked, width) {
  const k = width / CROP.w
  const z = (n) => Math.round(n * k)
  const PAD = 4
  const marks = !marked ? [] : RINGS.flatMap(({ n, box: b }) => {
    const x = z(b.x) - PAD, y = z(b.y) - PAD, w = z(b.width) + PAD * 2, h = z(b.height) + PAD * 2
    return [
      row(`Ring ${n.join(' ')}`, [], { w, h, radius: 3, fill: 'color.surface.highlight', stroke: { color: 'color.surface.inverse', width: 1 }, abs: { start: x, top: y } }),
      row(`Pins ${n.join(' ')}`, n.map(pin), { gap: 2, abs: { start: x + w + 8, top: y + Math.round(h / 2) - 9 } }),
    ]
  }).concat([row('Pins 1', [pin('1')], { abs: { end: 12, top: 12 } })])
  return col(name, marks, { w: width, h: z(CROP.h), ...box, clip: true, fill: { type: 'image', image, scaleMode: 'FILL' } })
}

function finding([title, fix], k) {
  return row(`Finding ${k + 1}`, [pin(String(k + 1)), col('Finding text', [text(title, 'V2Label', { w: 'fill', name: 'Rule' }), text(k === 0 ? `Whole page. ${fix}` : fix, 'V2Small', { color: 'color.text.soft', w: 'fill', name: 'Fix' })], { w: 'fill', gap: 2 })],
    { w: 'fill', gap: 'space.snug', align: 'start' })
}

const SHOT_D = 552
const SHOT_M = 326

function side(cond, mobile) {
  const alone = cond === 'Alone'
  const head = row(`${cond} head`, [text(cond, 'V2Label'), text(alone ? '14 of 20 rules · score 30' : '20 of 20 rules · score 100', 'V2Small', { color: 'color.text.faint' })], { w: 'fill', justify: 'between', align: 'center' })
  const list = alone
    ? col('Findings', FINDINGS.map(finding), { w: 'fill', gap: 'space.item' })
    : col('Findings', [row('All pass', [icon('check'), text('Passes all 20 rules.', 'V2Label')], { gap: 'space.tight', align: 'center' }), text('Right to left, Arabic type, the phone and amount isolated.', 'V2Small', { color: 'color.text.soft', w: 'fill' })], { w: 'fill', gap: 'space.tight' })
  const raw = text('Open the raw build', 'V2Small', { color: 'color.text.soft', name: 'Raw link' })
  const body = col(`${cond} body`, [shot(`${cond} shot`, alone ? 'benchAlone' : 'benchDualkit', alone, mobile ? SHOT_M : SHOT_D), list, raw], { w: 'fill', gap: 'space.group' })
  return col(`${cond} side`, [head, body], { w: 'fill', gap: 'space.item', pad: mobile ? 'space.item' : 'space.group' })
}

function screenHead([title, a, d], open, mobile = false) {
  const toggle = { shape: 'Toggle', kind: 'svg', size: [12, 12], svg: open ? CHEVRON_UP : CHEVRON_DOWN, tint: 'color.text.soft' }
  if (mobile) return col(`${title} head`, [
    row('Screen row', [text(title, 'Title', { w: 'fill', name: 'Screen' }), toggle], { w: 'fill', align: 'center' }),
    text(`${a} of 20 alone · ${d} of 20 with Dualkit`, 'V2Small', { color: 'color.text.soft', name: 'Results' }),
  ], { w: 'fill', gap: 'space.hair', pad: { block: 'space.item', inline: 'space.item' } })
  return row(`${title} head`, [
    text(title, 'Title', { w: 'fill', name: 'Screen' }),
    text(`${a} of 20 alone`, 'V2Small', { color: 'color.text.faint', name: 'Alone result' }),
    text(`${d} of 20 with Dualkit`, 'V2Small', { name: 'Dualkit result' }),
    { shape: 'Toggle', kind: 'svg', size: [12, 12], svg: open ? CHEVRON_UP : CHEVRON_DOWN, tint: 'color.text.soft' },
  ], { w: 'fill', gap: 'space.group', align: 'center', pad: { block: 'space.item', inline: 'space.group' } })
}
const CHEVRON_DOWN = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="#09090b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CHEVRON_UP = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 7.5l3-3 3 3" stroke="#09090b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function openPanel(mobile = false) {
  const [first, ...rest] = BENCH.screens
  const compare = mobile ? col('Compare', [side('Alone', true), hline('Compare rule'), side('With Dualkit', true)], { w: 'fill' })
    : row('Compare', [side('Alone', false), vline('Compare rule'), side('With Dualkit', false)], { w: 'fill' })
  const firstBlock = col(`${first[0]} open`, [screenHead(first, true, mobile), hline('Open rule'), compare], { w: 'fill' })
  return col('Screens', [firstBlock, ...rest.flatMap((s, k) => [hline(`Screen rule ${k + 1}`), screenHead(s, false, mobile)])], { w: 'fill', fill: 'color.surface.ground' })
}

// ---- pages ----

function leaderboardA() {
  return band('Leaderboard', [tableOf([headA(), ...BENCH.models.map(rowA)])], { gap: 'space.group' })
}
function leaderboardB() {
  return band('Leaderboard', [legendB(), tableOf([headB(), ...BENCH.models.map(rowB)])], { gap: 'space.group' })
}
function leaderboardOpen() {
  const [m, ...others] = BENCH.models
  const rows = [headA(), rowA(m), openPanel(false), ...others.map(rowA)]
  return band('Leaderboard', [tableOf(rows)], { gap: 'space.group' })
}

const page = (name, children) => ({
  screen: name, size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
  children: [nav(), ...children, footer()],
})

// ---- mobile ----

function cardA(m) {
  if (m.missing) return col(`${m.label} card`, [modelCell(m, 'fill'), text('Didn’t run this month', 'V2Label', { color: 'color.text.soft' }), text(m.missing, 'V2Small', { color: 'color.text.faint', w: 'fill' })], { w: 'fill', gap: 'space.tight', pad: 'space.item' })
  const bar = (label, v, on) => col(label, [ticks(`${label} ticks`, TICKS, Math.round(v / 4), on), row(`${label} line`, [text(label, 'V2Small', { color: 'color.text.soft' }), text(`${v} of 100`, 'V2Small')], { w: 'fill', justify: 'between' })], { w: 'fill', gap: 'space.hair' })
  return col(`${m.label} card`, [
    row('Card head', [modelCell(m, 'fill'), lift(m)], { w: 'fill', align: 'center' }),
    bar('Alone', m.alone, 'color.border.select'), bar('With Dualkit', m.dualkit, 'color.surface.inverse'),
  ], { w: 'fill', gap: 'space.item', pad: 'space.item' })
}

const TRACK_M = 326
function cardB(m) {
  if (m.missing) return cardA(m)
  return col(`${m.label} card`, [
    row('Card head', [modelCell(m, 'fill'), lift(m)], { w: 'fill', align: 'center' }),
    track(m, TRACK_M),
    row('Card numbers', [text(`Alone ${m.alone}`, 'V2Small', { color: 'color.text.soft' }), text(`With Dualkit ${m.dualkit}`, 'V2Small')], { w: 'fill', justify: 'between' }),
  ], { w: 'fill', gap: 'space.snug', pad: 'space.item' })
}

const mobilePage = (name, children) => ({
  screen: name, size: [390, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
  pad: { top: 'space.v2.inner', bottom: 'space.v2.inner', inline: 'space.item' }, gap: 'space.stack', children,
})

export const FRAMES = {
  'bench-a-desktop': () => page('Dualkit · Bench · A Tick table · Desktop · Sample data', [hero(), leaderboardA(), how()]),
  'bench-b-desktop': () => page('Dualkit · Bench · B Range track · Desktop · Sample data', [hero(), leaderboardB(), how()]),
  'bench-open-desktop': () => page('Dualkit · Bench · Row open · Desktop · Sample data', [hero(), leaderboardOpen(), how()]),
  'bench-empty-desktop': () => page('Dualkit · Bench · Before the first run · Desktop', [hero(),
    band('Empty', [col('Empty box', [text(BENCH.empty.heading, 'V2H2', { align: 'center', name: 'Heading' }), text(BENCH.empty.lede, 'V2Lede', { color: 'color.text.soft', align: 'center', w: 588, name: 'Lede' }), pill(BENCH.prompts)],
      { w: 'fill', align: 'center', gap: 'space.group', pad: { block: 'space.v2.inner', inline: 'space.block' }, ...box })]), how()]),
  'bench-a-mobile': () => mobilePage('Dualkit · Bench · A Tick table · Mobile · Sample data', [hero(true), tableOf(BENCH.models.map(cardA)), how(true)]),
  'bench-b-mobile': () => mobilePage('Dualkit · Bench · B Range track · Mobile · Sample data', [hero(true), legendB(), tableOf(BENCH.models.map(cardB)), how(true)]),
  'bench-open-mobile': () => mobilePage('Dualkit · Bench · Row open · Mobile · Sample data', [tableOf([cardA(BENCH.models[0]), openPanel(true), ...BENCH.models.slice(1, 3).map(cardA)])]),
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  for (const [slug, make] of Object.entries(FRAMES)) writeFileSync(resolve(SPECS, `${slug}.json`), JSON.stringify(make(), null, 2) + '\n')
  console.log('specs written')
}
