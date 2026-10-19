// The /bench page: a monthly leaderboard of free AI models building Arabic screens, alone and with Dualkit.
// Two leaderboard directions for Sam to pick from (A tick table, B range track), plus the open row and the empty state.
// Run: node gen/v2/bench.mjs, which writes specs/bench-*.json. All numbers are sample data until the first run.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LINE, band, col, hline, icon, pill, row, text, vline } from './parts.mjs'
import { footer, nav } from './home.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')
const MARKS = resolve(import.meta.dirname, '../../../assets/marks')
const markSvg = (file) => readFileSync(resolve(MARKS, `${file}.svg`), 'utf8').replace(/<title>.*?<\/title>/, '')
const mark = (m, size = 16) => ({ shape: `${m.by} mark`, kind: 'svg', size: [size, size], svg: markSvg(m.mark), tint: 'color.text.primary' })

export const BENCH = {
  headline: 'How well does AI\nbuild Arabic?',
  lede: 'Every month, free AI models build five Arabic screens on their own, then again with Dualkit. dualkit check scores every build against 20 rules.',
  month: 'November 2026',
  facts: '6 models · 5 screens · 180 builds',
  raw: 'Raw files on GitHub',
  prompts: 'Read the prompts',
  columns: ['Model', 'Alone', 'With Dualkit', 'Lift', 'Check score'],
  models: [
    { label: 'Gemini Flash', by: 'Google', mark: 'google', alone: 61, dualkit: 92, score: [18, 74], move: 0 },
    { label: 'Gemma 4 31B', by: 'Google', mark: 'google', alone: 54, dualkit: 88, score: [9, 66], move: 1 },
    { label: 'Nemotron 3 Ultra', by: 'NVIDIA', mark: 'nvidia', alone: 58, dualkit: 85, score: [12, 61], move: -1 },
    { label: 'Inkling', by: 'Thinking Machines', mark: 'thinking-machines', alone: 49, dualkit: 81, score: [4, 55], isNew: true },
    { label: 'Laguna S 2.1', by: 'Poolside', mark: 'poolside', alone: 42, dualkit: 71, score: [0, 41], move: 0 },
    { label: 'North Mini Code', by: 'Cohere', mark: 'cohere', missing: 'Fewer than two of three runs came back on three screens.' },
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


function modelCell(m, w = MODEL_W) {
  const names = col('Names', [
    text(m.label, 'V2Label', { name: 'Model' }),
    text(m.by, 'V2Small', { color: 'color.text.faint', name: 'Maker' }),
  ])
  const badge = row('Mark tile', [mark(m)], { w: 32, h: 32, justify: 'center', align: 'center', ...box })
  return row(`${m.label} name`, [badge, names], { w, gap: 'space.snug', align: 'center' })
}

const lift = (m) => text(`+${m.dualkit - m.alone}`, 'V2H2', { name: 'Lift' })

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

// ---- B: range track, one line from the alone score to the Dualkit score ----

const RANK_W = 40
const TRACK = 420
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

// Movement since last month: up, down, level, or new this month.
const UP = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M4 1.5L7 6H1z" fill="#09090b"/></svg>'
const DOWN = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M4 6.5L1 2h6z" fill="#09090b"/></svg>'
function movement(m) {
  if (m.missing) return text('–', 'V2Small', { color: 'color.text.faint', name: 'Move' })
  if (m.isNew) return text('New', 'V2Small', { color: 'color.text.faint', name: 'Move' })
  if (!m.move) return text('–', 'V2Small', { color: 'color.text.faint', name: 'Move' })
  const up = m.move > 0
  return row('Move', [{ shape: up ? 'Up' : 'Down', kind: 'svg', size: [8, 8], svg: up ? UP : DOWN, tint: up ? 'color.text.primary' : 'color.text.faint' },
    text(String(Math.abs(m.move)), 'V2Small', { color: up ? 'color.text.primary' : 'color.text.faint' })], { gap: 2, align: 'center' })
}
const rankCell = (m, k) => col('Rank', [text(m.missing ? '–' : String(k + 1), 'V2Label', { color: m.missing ? 'color.text.faint' : 'color.text.primary', name: 'Rank number' }), movement(m)], { w: RANK_W, gap: 2 })

function rowB(m, k) {
  if (m.missing) return row(`${m.label} row`, [rankCell(m, k), ...missingRow(m, []).children], { w: 'fill', gap: 'space.block', align: 'center', pad: { block: 'space.group', inline: 'space.group' } })
  return row(`${m.label} row`, [rankCell(m, k), modelCell(m), col('Track cell', [track(m)], { w: TRACK }), pair(m), col('Lift cell', [lift(m)], { w: LIFT_W })],
    { w: 'fill', gap: 'space.block', align: 'center', pad: { block: 'space.group', inline: 'space.group' } })
}

function headB() {
  const scale = row('Scale', ['0', '25', '50', '75', '100'].map((s) => text(s, 'V2Small', { color: 'color.text.faint', name: `Scale ${s}` })), { w: TRACK, justify: 'between' })
  const t = (s, w) => text(s, 'V2Small', { color: 'color.text.faint', w, name: s })
  return row('Header', [t('Rank', RANK_W), t('Model', MODEL_W), scale, t('Alone → with Dualkit', SCORE_W), t('Lift', LIFT_W)], { w: 'fill', gap: 'space.block', pad: { block: 'space.snug', inline: 'space.group' } })
}

function legendB() {
  return row('Legend', [
    row('Legend alone', [ring('Legend ring'), text('Alone', 'V2Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    row('Legend dualkit', [{ shape: 'Legend dot', kind: 'ellipse', size: [12, 12], fill: 'color.surface.inverse' }, text('With Dualkit', 'V2Small', { color: 'color.text.soft' })], { gap: 'space.tight', align: 'center' }),
    text('Rules passed across five screens, out of 100', 'V2Small', { color: 'color.text.faint' }),
  ], { gap: 'space.group', align: 'center', wrap: true, w: 'fill' })
}

// ---- the live layer: a status line above the board, and a ticker of builds while a run is going ----

const dot = (live) => ({ shape: live ? 'Live dot' : 'Idle dot', kind: 'ellipse', size: ['size.dot', 'size.dot'], fill: live ? 'color.signal.dot' : 'color.border.select' })

function status(running, mobile = false) {
  const left = running
    ? row('Status left', [dot(true), text('Running now', 'V2Label'), text('112 of 180 builds', 'V2Small', { color: 'color.text.soft', name: 'Progress' })], { gap: 'space.tight', align: 'center', wrap: true })
    : row('Status left', [dot(false), text('Last run 1 November, 04:17 UTC', 'V2Small', { color: 'color.text.soft', name: 'Last run' })], { gap: 'space.tight', align: 'center' })
  const right = running
    ? row('Status right', [ticks('Run progress', 30, 19), text('62%', 'V2Mono', { color: 'color.text.soft' })], { w: mobile ? 'fill' : 240, gap: 'space.snug', align: 'center' })
    : row('Status right', [text('Next run in', 'V2Small', { color: 'color.text.soft' }), text('12d 04:12:33', 'V2Mono', { name: 'Countdown' })], { gap: 'space.tight', align: 'center' })
  return mobile ? col('Status', [left, right], { w: 'fill', gap: 'space.snug' }) : row('Status', [left, right], { w: 'fill', justify: 'between', align: 'center' })
}

const FEED = [
  ['06:41', 'Gemma 4 31B', 'google', 'Order history', 'with Dualkit', '18 of 20'],
  ['06:40', 'Laguna S 2.1', 'poolside', 'Profile', 'alone', '9 of 20'],
  ['06:39', 'Nemotron 3 Ultra', 'nvidia', 'Address form', 'with Dualkit', '17 of 20'],
  ['06:39', 'Inkling', 'thinking-machines', 'One-time code', 'alone', '11 of 20'],
  ['06:38', 'Gemini Flash', 'google', 'Order history', 'with Dualkit', '19 of 20'],
  ['06:37', 'North Mini Code', 'cohere', 'Profile', 'alone', 'No page in the reply'],
]

function ticker(mobile = false) {
  const item = ([at, model, file, screen, cond, result], k) => row(`Build ${k + 1}`, [
    text(at, 'V2Mono', { color: 'color.text.faint', name: 'Time' }),
    mark({ by: model, mark: file }, 12),
    text(model, 'V2Small', { name: 'Model' }),
    text(`${screen}, ${cond}`, 'V2Small', { color: 'color.text.soft', name: 'Build' }),
    text(result, 'V2Small', { color: k === 5 ? 'color.text.faint' : 'color.text.primary', name: 'Result' }),
  ], { gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.item' } })
  const items = FEED.map(item).flatMap((it, k) => [...(k ? [vline(`Feed rule ${k}`)] : []), it])
  // On a phone each build takes two lines: who and when, then what it built and how it did.
  const itemM = ([at, model, file, screen, cond, result], k) => col(`Build ${k + 1}`, [
    row('Build top', [text(at, 'V2Mono', { color: 'color.text.faint', name: 'Time' }), mark({ by: model, mark: file }, 12), text(model, 'V2Small', { w: 'fill', name: 'Model' }), text(result, 'V2Small', { color: k === 5 ? 'color.text.faint' : 'color.text.primary', name: 'Result' })], { w: 'fill', gap: 'space.tight', align: 'center' }),
    text(`${screen}, ${cond}`, 'V2Small', { color: 'color.text.soft', w: 'fill', name: 'Build' }),
  ], { w: 'fill', gap: 2, pad: { block: 'space.snug', inline: 'space.item' } })
  if (mobile) return col('Ticker', FEED.slice(0, 4).map(itemM).flatMap((it, k) => [...(k ? [hline(`Feed rule ${k}`)] : []), it]), { w: 'fill', ...box })
  return row('Ticker', items, { w: 'fill', clip: true, ...box })
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

function leaderboard(running) {
  return band('Leaderboard', [status(running), ...(running ? [ticker()] : []), legendB(), tableOf([headB(), ...BENCH.models.map(rowB)])], { gap: 'space.group' })
}
function leaderboardOpen() {
  const [m, ...others] = BENCH.models
  return band('Leaderboard', [status(false), legendB(), tableOf([headB(), rowB(m, 0), openPanel(false), ...others.map((o, k) => rowB(o, k + 1))])], { gap: 'space.group' })
}

const page = (name, children) => ({
  screen: name, size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
  children: [nav(), ...children, footer()],
})

// ---- mobile ----

const TRACK_M = 326
function cardB(m, k) {
  const head = row('Card head', [col('Rank', [text(m.missing ? '–' : String(k + 1), 'V2Label', { color: m.missing ? 'color.text.faint' : 'color.text.primary', name: 'Rank number' }), movement(m)], { w: 28, gap: 2 }),
    modelCell(m, 'fill'), ...(m.missing ? [] : [lift(m)])], { w: 'fill', gap: 'space.snug', align: 'center' })
  if (m.missing) return col(`${m.label} card`, [head, text('Didn’t run this month', 'V2Label', { color: 'color.text.soft' }), text(m.missing, 'V2Small', { color: 'color.text.faint', w: 'fill' })], { w: 'fill', gap: 'space.tight', pad: 'space.item' })
  return col(`${m.label} card`, [
    head,
    track(m, TRACK_M),
    row('Card numbers', [text(`Alone ${m.alone}`, 'V2Small', { color: 'color.text.soft' }), text(`With Dualkit ${m.dualkit}`, 'V2Small')], { w: 'fill', justify: 'between' }),
  ], { w: 'fill', gap: 'space.snug', pad: 'space.item' })
}

const mobilePage = (name, children) => ({
  screen: name, size: [390, 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
  pad: { top: 'space.v2.inner', bottom: 'space.v2.inner', inline: 'space.item' }, gap: 'space.stack', children,
})

const mobileBoard = (running) => col('Board', [status(running, true), ...(running ? [ticker(true)] : []), legendB(), tableOf(BENCH.models.map(cardB))], { w: 'fill', gap: 'space.group' })

export const FRAMES = {
  'bench-b-between-desktop': () => page('Dualkit · Bench · B · Between runs · Desktop · Sample data', [hero(), leaderboard(false), how()]),
  'bench-b-running-desktop': () => page('Dualkit · Bench · B · Run in progress · Desktop · Sample data', [hero(), leaderboard(true), how()]),
  'bench-b-open-desktop': () => page('Dualkit · Bench · B · Row open · Desktop · Sample data', [hero(), leaderboardOpen(), how()]),
  'bench-empty-desktop': () => page('Dualkit · Bench · Before the first run · Desktop', [hero(),
    band('Empty', [col('Empty box', [text(BENCH.empty.heading, 'V2H2', { align: 'center', name: 'Heading' }), text(BENCH.empty.lede, 'V2Lede', { color: 'color.text.soft', align: 'center', w: 588, name: 'Lede' }), pill(BENCH.prompts)],
      { w: 'fill', align: 'center', gap: 'space.group', pad: { block: 'space.v2.inner', inline: 'space.block' }, ...box })]), how()]),
  'bench-b-between-mobile': () => mobilePage('Dualkit · Bench · B · Between runs · Mobile · Sample data', [hero(true), mobileBoard(false), how(true)]),
  'bench-b-running-mobile': () => mobilePage('Dualkit · Bench · B · Run in progress · Mobile · Sample data', [hero(true), mobileBoard(true), how(true)]),
  'bench-b-open-mobile': () => mobilePage('Dualkit · Bench · B · Row open · Mobile · Sample data', [tableOf([cardB(BENCH.models[0], 0), openPanel(true), ...BENCH.models.slice(1, 3).map((m, k) => cardB(m, k + 1))])]),
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(SPECS, { recursive: true })
  for (const [slug, make] of Object.entries(FRAMES)) writeFileSync(resolve(SPECS, `${slug}.json`), JSON.stringify(make(), null, 2) + '\n')
  console.log('specs written')
}
