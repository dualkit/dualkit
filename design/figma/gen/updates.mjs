// dualkit.dev/updates, desktop: every release, newest first, then what is being built next.
// Only real releases go here. Run: node gen/updates.mjs, which writes specs/updates-desktop.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { COPY } from './copy.mjs'
import { RING, band, col, footer, icon, nav, row, rule, text } from './kit.mjs'

const OUT = resolve(import.meta.dirname, '../specs/updates-desktop.json')

const pill = (label, name = label) => row(`${name} pill`, [text(label, 'CodeSmall', { color: 'color.text.secondary' })],
  { pad: { block: 'space.hair', inline: 'space.tight' }, radius: 'radius.pill', stroke: RING })

const ghostButton = (label, glyph) => row(`${label} button`, [icon(glyph), text(label, 'Label')],
  { gap: 'space.tight', align: 'center', pad: { block: 'space.control.block', inline: 'space.control.inline' }, radius: 'radius.control', stroke: RING })

function header() {
  const u = COPY.updates
  return band('Updates header', [
    text(u.title, 'Display', { name: 'Title' }),
    row('Header row', [
      col('Lede wrap', [text(u.lede, 'Lede', { color: 'color.text.secondary', w: 'fill', name: 'Lede' })], { w: 'size.text' }),
      row('Follow', [ghostButton(u.rss, 'rss'), ghostButton(u.github, 'star')], { gap: 'space.snug' }),
    ], { w: 'fill', justify: 'between', align: 'end' }),
  ], { gap: 'space.group', pad: { top: 'space.head', bottom: 'space.stack' } })
}

function shippedCard(items) {
  return col('Shipped', items.flatMap(([name, line], k) => [
    ...(k ? [rule()] : []),
    row(`${name} item`, [
      icon('check', 'color.signal.dot'),
      col(`${name} text`, [text(name, 'Code', { w: 'fill', name: 'Item name' }), text(line, 'Caption', { color: 'color.text.muted', w: 'fill', name: 'Item line' })], { w: 'fill', gap: 'space.hair' }),
    ], { w: 'fill', gap: 'space.snug', align: 'start', pad: { block: 'space.item' } }),
  ]), { w: 'fill', pad: { inline: 'space.group' }, radius: 'radius.inset', fill: 'color.surface.page', stroke: RING })
}

function entry(e) {
  const rail = col('Entry rail', [
    text(e.date, 'Label', { name: 'Date' }),
    pill(e.version, 'Version'),
  ], { w: 'size.col.date', gap: 'space.tight' })
  const body = col('Entry body', [
    row('Entry tags', e.tags.map((t) => pill(t)), { gap: 'space.tight' }),
    text(e.title, 'Heading', { w: 'fill', name: 'Entry title' }),
    ...e.body.map((p) => text(p, 'Lede', { color: 'color.text.secondary', w: 'fill', name: 'Paragraph' })),
    col('Shipped panel', [text(e.shippedTitle, 'Label', { color: 'color.text.muted' }), shippedCard(e.shipped)],
      { w: 'fill', gap: 'space.snug', pad: 'space.snug', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING }),
  ], { w: 'size.updates.body', gap: 'space.group' })
  return col(`${e.version} entry`, [rule(), row('Entry row', [rail, body], { w: 'fill', gap: 'space.head', align: 'start', pad: { top: 'space.stack' } })], { w: 'fill' })
}

function next() {
  const n = COPY.updates.next
  const card = ([title, line, state]) => col(`${title} card`, [
    row(`${title} card head`, [text(title, 'Title', { name: 'Card title' }), pill(state, 'State')], { w: 'fill', justify: 'between', align: 'center' }),
    text(line, 'Body', { color: 'color.text.secondary', w: 'fill', name: 'Card line' }),
  ], { w: 'fill', gap: 'space.snug', pad: 'space.card', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING })
  return band('Up next', [
    rule(),
    row('Next row', [
      col('Next rail', [text(n.title, 'Label', { name: 'Next title' })], { w: 'size.col.date' }),
      row('Next cards', n.items.map(card), { w: 'size.updates.body', gap: 'space.group', align: 'start' }),
    ], { w: 'fill', gap: 'space.head', align: 'start', pad: { top: 'space.stack' } }),
  ], { pad: { top: 'space.section', bottom: 'space.section' } })
}

export function updates() {
  return {
    screen: 'Dualkit · Updates · Desktop',
    size: ['size.desktop', 'hug'],
    direction: 'ltr',
    lang: 'en',
    fill: 'color.surface.page',
    textColor: 'color.text.primary',
    children: [nav(), header(), band('Entries', COPY.updates.entries.map(entry)), next(), footer()],
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(resolve(OUT, '..'), { recursive: true })
  writeFileSync(OUT, JSON.stringify(updates(), null, 2) + '\n')
  console.log(OUT)
}
