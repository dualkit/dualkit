// dualkit.dev home page, desktop, as a figma-render spec. Copy lives in copy.mjs.
// Run: node gen/home.mjs, which writes specs/home-desktop.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { COPY } from './copy.mjs'
import { RING, band, col, commandBox, dirCol, dirRow, icon, nav, primaryButton, row, rule, sectionHead, segmented, text, closing, footer, worksWith } from './kit.mjs'
import { starter } from './starter.mjs'

const OUT = resolve(import.meta.dirname, '../specs/home-desktop.json')
function hero() {
  const h = COPY.hero
  const badge = row('Badge', [text(h.badge, 'CodeSmall', { color: 'color.text.secondary' })],
    { pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', stroke: RING })
  const command = commandBox('Command', h.command)
  const cta = primaryButton(h.cta)
  return band('Hero', [
    badge,
    text(h.headline, 'Display', { align: 'center', name: 'Headline' }),
    col('Lede wrap', [text(h.lede, 'Lede', { color: 'color.text.secondary', align: 'center', w: 'fill', name: 'Lede' })], { w: 'size.hero.lede' }),
    col('Install', [segmented('Install tabs', h.tabs), row('Install row', [command, cta], { gap: 'space.snug', align: 'center' })], { gap: 'space.item', align: 'center' }),
  ], { align: 'center', gap: 'space.group', pad: { top: 'space.section', bottom: 'space.head' } })
}

function paymentCard(c, rtl) {
  const R = dirRow(rtl), C = dirCol(rtl)
  const t = rtl ? { title: 'ArabicTitle', label: 'ArabicLabel', caption: 'ArabicCaption', body: 'ArabicBody', amount: 'ArabicAmount' }
    : { title: 'Title', label: 'Label', caption: 'Caption', body: 'Body', amount: 'Amount' }
  const align = rtl ? 'end' : 'start'
  const header = R('Card header', [
    row('Back button', [icon(rtl ? 'forward' : 'back')], { pad: 'space.tight', radius: 'radius.pill', stroke: RING }),
    text(c.title, t.title, { name: 'Title' }),
  ], { gap: 'space.snug', align: 'center', w: 'fill' })
  const amount = C('Amount', [text(c.amountLabel, t.caption, { color: 'color.text.muted' }), text(c.amount, t.amount, { name: 'Amount value' })], { gap: 'space.hair', w: 'fill' })
  const rows = col('Dates', c.rows.map(([k, v]) => R(`${k} row`, [text(k, t.label, { color: 'color.text.muted' }), text(v, t.label, { name: `${k} value` })], { w: 'fill', justify: 'between', pad: { block: 'space.snug' } })), { w: 'fill' })
  const phone = C('Phone field', [
    text(c.phoneLabel, t.label, { color: 'color.text.secondary' }),
    row('Phone input', [text('+971', 'Code', { color: 'color.text.muted' }), text(c.phone, 'Code', { name: 'Phone value' })],
      { w: 'fill', gap: 'space.tight', pad: { block: 'space.control.block', inline: 'space.item' }, radius: 'radius.control', stroke: RING, fill: 'color.surface.page' }),
  ], { gap: 'space.tight', w: 'fill' })
  const pay = row('Pay button', [text(c.pay, t.label, { color: 'color.text.inverse' })],
    { w: 'fill', justify: 'center', pad: { block: 'space.control.block' }, radius: 'radius.control', fill: 'color.surface.inverse' })
  const content = col('Card content', [
    header, amount, col('Detail', [rule(), rows, rule()], { w: 'fill' }),
    text(c.items, t.body, { color: 'color.text.secondary', name: 'Items line', align, w: 'fill' }),
    phone,
  ], { w: 'fill', gap: 'space.group', align: rtl ? 'end' : 'start' })
  return col(rtl ? 'Payment summary · Arabic' : 'Payment summary · English', [content, pay],
    { w: 'size.card.demo', h: 'size.card.stage', justify: 'between', pad: 'space.block', radius: 'radius.card', fill: 'color.surface.page', stroke: RING })
}

function stage() {
  const s = COPY.stage
  return band('Stage', [
    col('Stage panel', [
      segmented('Language toggle', s.toggle, 0, ['Label', 'ArabicLabel']),
      row('Cards', [paymentCard(s.en, false), paymentCard(s.ar, true)], { gap: 'space.stack', align: 'start' }),
    ], { w: 'fill', align: 'center', gap: 'space.stack', pad: { block: 'space.head' }, radius: 'radius.card', fill: 'color.surface.raised', stroke: RING }),
    text(s.caption, 'Caption', { color: 'color.text.muted', align: 'center', name: 'Stage caption' }),
  ], { align: 'center', gap: 'space.item' })
}

function strip() {
  const cell = ([n, l, src], k) => col(`${l} figure`, [
    row(`${l} source`, [text(src, 'CodeSmall', { color: 'color.text.muted', name: 'Source' })], { pad: { block: 'space.none', inline: 'space.tight' }, radius: 'radius.pill', fill: 'color.surface.page', stroke: RING }),
    col(`${l} value`, [text(n, 'Figure', { name: 'Figure' }), text(l, 'Caption', { color: 'color.text.muted', name: 'Label' })], { gap: 'space.hair', w: 'fill' }),
  ], { w: 'fill', gap: 'space.group', pad: { top: 'space.group', bottom: 'space.block', inline: 'space.block' } })
  const items = COPY.strip.flatMap((item, k) => [
    ...(k ? [{ shape: 'Strip divider', kind: 'rect', size: ['size.stroke', 1], w: 'size.stroke', h: 'fill', fill: 'color.border.divider' }] : []),
    cell(item, k),
  ])
  return band('Strip', [row('Strip panel', items, { w: 'fill', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING, clip: true })], { pad: { top: 'space.head' } })
}


function skills() {
  const s = COPY.skills
  const list = col('Skill list', s.list.flatMap(([name, line], k) => [
    ...(k ? [rule()] : []),
    row(`${name} row`, [col('Skill name cell', [text(name, 'Code', { name: 'Skill name', w: 'fill' })], { w: 'size.col.skill' }), text(line, 'Caption', { color: 'color.text.muted', name: 'Skill line', w: 'fill' })], { w: 'fill', gap: 'space.item', pad: { block: 'space.item' } }),
  ]), { w: 'fill' })
  const cellRow = (cells, style, name) => row(name, cells.map((c, k) => text(c, k ? 'CodeSmall' : style, { w: k ? 80 : 'fill', align: k ? 'end' : 'start', color: k === 1 ? 'color.text.muted' : 'color.text.primary', name: `Cell ${k + 1}` })), { w: 'fill', gap: 'space.item', pad: { block: 'space.snug' }, align: 'center' })
  const evalCard = col('Eval card', [
    col('Eval top', [
      col('Eval head', [text(s.evalTitle, 'Title', { w: 'fill' }), text(s.evalNote, 'Caption', { color: 'color.text.muted', w: 'fill' })], { w: 'fill', gap: 'space.hair' }),
      segmented('Eval toggle', s.evalToggle, 1),
      col('Live line', [
        row('Live tag', [text(s.liveTag, 'CodeSmall', { color: 'color.text.muted' }), text(s.liveState, 'CodeSmall', { color: 'color.text.muted' })], { w: 'fill', justify: 'between' }),
        row('Live sample', [text(s.liveSample, 'ArabicTitle', { name: 'Arabic sample' })], { w: 'fill', justify: 'end' }),
      ], { w: 'fill', gap: 'space.tight', pad: 'space.group', radius: 'radius.inset', fill: 'color.surface.page', stroke: RING }),
    ], { w: 'fill', gap: 'space.group' }),
    col('Eval table', [
      cellRow(s.evalHead, 'Caption', 'Eval header'),
      ...s.evalRows.flatMap((r, k) => [rule(), cellRow(r, 'Label', `Eval row ${k + 1}`)]),
    ], { w: 'fill' }),
  ], { w: 'size.card.half', h: 'fill', justify: 'between', pad: 'space.card', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING })
  return band('Skills', [row('Skills row', [col('Skills copy', [sectionHead(s), list], { w: 'fill', h: 'fill', justify: 'between' }), evalCard], { w: 'fill', gap: 'space.head', align: 'start' })], { pad: { top: 'space.section' } })
}

function format() {
  const f = COPY.format
  const demo = col('Format demo', [
    col('Input field', [
      text(f.inputLabel, 'Label', { color: 'color.text.secondary' }),
      row('Amount input', [text(f.input, 'Code', { name: 'Input value' }), { shape: 'Caret', kind: 'rect', size: [2, 20], fill: 'color.text.primary' }],
        { w: 'fill', gap: 'space.hair', align: 'center', pad: { block: 'space.control.block', inline: 'space.item' }, radius: 'radius.control', fill: 'color.surface.page', stroke: { color: 'color.border.strong', width: 'size.stroke' } }),
    ], { w: 'fill', gap: 'space.tight' }),
    col('Outputs', f.outputs.flatMap(([k, v], i) => [
      ...(i ? [rule()] : []),
      row(`${k} output`, [
        text(k, 'Caption', { color: 'color.text.muted', w: 80 }),
        text(v, k === 'Arabic' ? 'ArabicLabel' : 'Code', { name: `${k} value`, w: 'fill' }),
        ...(k === 'IBAN' ? [row('Valid', [icon('check', 'color.signal.dot'), text(f.valid, 'Caption', { color: 'color.text.secondary' })], { gap: 'space.hair', align: 'center' })] : []),
      ], { w: 'fill', gap: 'space.item', align: 'center', pad: { block: 'space.snug' } }),
    ]), { w: 'fill', pad: { inline: 'space.item' }, radius: 'radius.inset', fill: 'color.surface.page', stroke: RING }),
  ], { w: 'size.card.half', gap: 'space.group', pad: 'space.snug', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING })
  const install = row('Format install', [text(f.install, 'Code'), icon('copy', 'color.text.muted')],
    { gap: 'space.group', align: 'center', pad: { block: 'space.control.block', inline: 'space.control.inline' }, radius: 'radius.control', fill: 'color.surface.panel', stroke: RING })
  return band('Format', [row('Format row', [demo, col('Format copy', [sectionHead(f), install], { w: 'fill', gap: 'space.block' })], { w: 'fill', gap: 'space.head', align: 'center' })], { pad: { top: 'space.section' } })
}




export function home() {
  return {
    screen: 'Dualkit · Home · Desktop',
    size: ['size.desktop', 'hug'],
    direction: 'ltr',
    lang: 'en',
    fill: 'color.surface.page',
    textColor: 'color.text.primary',
    children: [nav(), hero(), worksWith(), stage(), strip(), skills(), format(), starter(), closing(), footer()],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(resolve(OUT, '..'), { recursive: true })
  writeFileSync(OUT, JSON.stringify(home(), null, 2) + '\n')
  console.log(OUT)
}
