// Shared spec helpers and the pieces every dualkit.dev page uses: nav, closing call to action, footer.
import { COPY } from './copy.mjs'
import { ICONS, MARK, TOOLS } from './icons.mjs'

export const RING = { color: 'color.border.ring', width: 'size.stroke' }

export const text = (characters, style, extra = {}) => ({ text: characters, style, ...extra })
export const row = (name, children, extra = {}) => ({ stack: name, dir: 'row', children, ...extra })
export const col = (name, children, extra = {}) => ({ stack: name, dir: 'col', children, ...extra })
export const icon = (name, tint = 'color.text.primary') => ({ shape: `${name} icon`, kind: 'svg', size: ['size.icon', 'size.icon'], svg: ICONS[name], tint })
export const rule = (name = 'Divider') => ({ shape: name, kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill: 'color.border.divider' })
export const band = (name, children, extra = {}) => row(`${name} band`, [col(name, children, { w: 'size.content', ...extra })], { w: 'fill', justify: 'center' })

// In an Arabic card the inline axis runs the other way: rows reverse and columns align to the end.
export const dirRow = (rtl) => (name, children, extra = {}) => row(name, rtl ? [...children].reverse() : children, rtl ? { justify: 'end', ...extra } : extra)
export const dirCol = (rtl) => (name, children, extra = {}) => col(name, children, { align: rtl ? 'end' : 'start', ...extra })

export function nav() {
  const brand = row('Brand', [markGlyph('Mark'), text('Dualkit', 'Title')], { w: 'size.nav.end', gap: 'space.tight', align: 'center' })
  const links = row('Links', COPY.nav.map((l) => text(l, 'Label', { color: 'color.text.secondary', name: l })), { gap: 'space.block' })
  const github = row('GitHub button', [icon('star'), text(COPY.github, 'Label')],
    { gap: 'space.tight', align: 'center', pad: { block: 'space.tight', inline: 'space.item' }, radius: 'radius.pill', stroke: RING })
  const end = row('Nav end', [github], { w: 'size.nav.end', justify: 'end', gap: 'space.group', align: 'center' })
  return band('Nav', [row('Nav row', [brand, links, end], { w: 'fill', justify: 'between', align: 'center' })], { pad: { block: 'space.group' } })
}

export function segmented(name, labels, active = 0, styles = []) {
  return row(name, labels.map((l, k) => row(`${l} segment`, [text(l, styles[k] ?? 'Label', { color: k === active ? 'color.text.primary' : 'color.text.muted' })], {
    pad: { block: 'space.tight', inline: 'space.item' }, radius: 'radius.pill',
    ...(k === active ? { fill: 'color.surface.page', stroke: RING } : {}),
  })), { pad: 'space.hair', radius: 'radius.pill', fill: 'color.surface.panel', gap: 'space.none' })
}


export const sectionHead = (s, extra = []) => col(`${s.eyebrow} head`, [
  row(`${s.eyebrow} eyebrow`, [text(s.eyebrow, 'Label', { color: 'color.text.muted' }), ...extra], { gap: 'space.snug', align: 'center' }),
  text(s.heading, 'Heading', { name: 'Heading' }),
  text(s.lede, 'Lede', { color: 'color.text.secondary', w: 'fill', name: 'Lede' }),
], { gap: 'space.item', w: 'fill' })

export const commandBox = (name, command) => row(name, [text(command, 'Code', { name: 'Command' }), icon('copy', 'color.text.muted')],
  { gap: 'space.group', align: 'center', pad: { block: 'space.control.block', inline: 'space.control.inline' }, radius: 'radius.control', fill: 'color.surface.panel', stroke: RING })

export const primaryButton = (label) => row('Primary button', [text(label, 'Label', { color: 'color.text.inverse' }), icon('arrow', 'color.text.inverse')],
  { gap: 'space.tight', align: 'center', pad: { block: 'space.control.block', inline: 'space.control.inline' }, radius: 'radius.control', fill: 'color.surface.inverse' })

export const markGlyph = (name = 'Mark', light = 'color.mark.light') => row(name, [
  { shape: 'Mark start', kind: 'svg', size: [9, 20], svg: MARK.start, tint: 'color.text.primary' },
  { shape: 'Mark end', kind: 'svg', size: [9, 20], svg: MARK.end, tint: light },
], { gap: 'space.mark' })

const statusLine = () => row('Status', [
  { shape: 'Status dot', kind: 'ellipse', size: ['size.dot', 'size.dot'], fill: 'color.signal.dot' },
  text(COPY.status, 'Caption', { color: 'color.text.secondary' }),
], { gap: 'space.tight', align: 'center' })

// The closing call to action: the last thing before the footer, so the page ends on the install.
export function closing() {
  const c = COPY.closing
  return band('Closing', [
    col('Closing panel', [
      text(c.heading, 'Display', { align: 'center', name: 'Closing headline' }),
      text(c.lede, 'Lede', { color: 'color.text.secondary', align: 'center', name: 'Closing lede' }),
      row('Closing actions', [commandBox('Closing command', COPY.hero.command), primaryButton(COPY.hero.cta)], { gap: 'space.snug', align: 'center' }),
    ], { w: 'fill', align: 'center', gap: 'space.group', pad: { block: 'space.section' }, radius: 'radius.card', fill: 'color.surface.raised', stroke: RING }),
  ], { pad: { block: 'space.section' } })
}

// The footer: link columns over a wordmark that runs edge to edge, half ink and half outline like the mark.
export function footer() {
  const f = COPY.footer
  const column = ([title, links]) => col(`${title} column`, [
    text(title, 'Label', { color: 'color.text.muted', name: 'Column title' }),
    ...links.map((l) => text(l, 'Body', { name: l })),
  ], { w: 'size.col.footer', gap: 'space.snug' })
  const brand = col('Footer brand', [
    row('Footer brand row', [markGlyph('Footer mark', 'color.mark.onPanel'), text('Dualkit', 'Title')], { gap: 'space.tight', align: 'center' }),
    text(f.tagline, 'Body', { color: 'color.text.secondary', name: 'Tagline' }),
    statusLine(),
  ], { w: 'fill', gap: 'space.item' })
  const wordmark = row('Wordmark', [
    text('Dual', 'Wordmark', { name: 'Wordmark ink' }),
    text('kit', 'Wordmark', { name: 'Wordmark light', color: 'color.text.ghost' }),
  ], { w: 'fill', h: 'size.wordmark', justify: 'center', align: 'start', gap: 'space.none', clip: true })
  const bottom = row('Footer bottom', [
    text(f.legal, 'Caption', { color: 'color.text.muted', name: 'Legal' }),
    text(f.note, 'Caption', { color: 'color.text.muted', name: 'Arabic note' }),
  ], { w: 'size.content', justify: 'between' })
  return col('Footer', [
    row('Footer top', [row('Footer grid', [brand, ...f.columns.map(column)], { w: 'size.content', gap: 'space.stack', align: 'start' })], { w: 'fill', justify: 'center' }),
    row('Footer bottom band', [bottom], { w: 'fill', justify: 'center' }),
    wordmark,
  ], { w: 'fill', gap: 'space.stack', align: 'center', pad: { top: 'space.section' }, fill: 'color.surface.panel' })
}

// Works with: the tools Dualkit plugs into, set in their own marks. Static here; a 32px/s ticker in code.
export function worksWith() {
  const item = (t) => row(`${t.label} tool`, [
    { shape: `${t.label} mark`, kind: 'svg', size: [22, 22], svg: t.svg, tint: 'color.text.muted' },
    text(t.label, 'Tool', { color: 'color.text.muted', name: 'Tool name' }),
  ], { gap: 'space.snug', align: 'center', pad: { inline: 'space.block' } })
  return col('Works with', [
    text(COPY.worksWith, 'Caption', { color: 'color.text.muted', align: 'center', name: 'Works with caption' }),
    row('Tool row', TOOLS.map(item), { w: 'fill', justify: 'start', align: 'center', clip: true, pad: { start: 'space.edge' } }),
  ], { w: 'fill', gap: 'space.group', align: 'center', pad: { bottom: 'space.head' } })
}
