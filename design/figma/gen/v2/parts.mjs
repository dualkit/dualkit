// v2 building blocks: square media, hairline lines, pill buttons, generous space.
import { ICONS, MARK } from '../icons.mjs'

export const LINE = { color: 'color.border.ring', width: 'size.stroke' }
export const text = (characters, style, extra = {}) => ({ text: characters, style, ...extra })
export const row = (name, children, extra = {}) => ({ stack: name, dir: 'row', children, ...extra })
export const col = (name, children, extra = {}) => ({ stack: name, dir: 'col', children, ...extra })
export const icon = (name, tint = 'color.text.primary', size = 'size.icon') => ({ shape: `${name} icon`, kind: 'svg', size: [size, size], svg: ICONS[name], tint })
export const hline = (name = 'Rule') => ({ shape: name, kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill: 'color.border.grid' })
export const vline = (name = 'Column rule') => ({ shape: name, kind: 'rect', size: ['size.stroke', 1], w: 'size.stroke', h: 'fill', fill: 'color.border.grid' })
export const band = (name, children, extra = {}) => row(`${name} band`, [col(name, children, { w: 'size.v2.content', ...extra })], { w: 'fill', justify: 'center' })

export const pill = (label, { primary = false, glyph } = {}) => row(`${label} button`, [
  ...(glyph ? [icon(glyph, primary ? 'color.text.inverse' : 'color.text.primary')] : []),
  text(label, 'V2Label', { color: primary ? 'color.text.inverse' : 'color.text.primary' }),
], { gap: 'space.tight', align: 'center', pad: { block: 'space.snug', inline: 'space.group' }, radius: 'radius.pill',
  ...(primary ? { fill: 'color.surface.inverse' } : { stroke: LINE, fill: 'color.surface.page' }) })

export const mark = (name = 'Mark', light = 'color.mark.onPanel') => row(name, [
  { shape: 'Mark start', kind: 'svg', size: [9, 20], svg: MARK.start, tint: 'color.text.primary' },
  { shape: 'Mark end', kind: 'svg', size: [9, 20], svg: MARK.end, tint: light },
], { gap: 'space.mark' })

export function seg(name, labels, active = 0) {
  return row(name, labels.map((l, k) => row(`${l} segment`, [text(l, 'V2Small', { color: k === active ? 'color.text.primary' : 'color.text.faint' })], {
    pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', ...(k === active ? { fill: 'color.surface.page', stroke: LINE } : {}),
  })), { pad: 'space.hair', radius: 'radius.pill', fill: 'color.surface.panel' })
}

/** A section opener: hairline rule, mono number, name. */
export const opener = (no, name) => col(`${no} opener`, [
  hline(`${no} rule`),
  row(`${no} label`, [text(no, 'V2Mono', { color: 'color.text.faint', name: 'Number' }), text(name, 'V2Mono', { name: 'Name' })], { gap: 'space.snug', pad: { top: 'space.snug' } }),
], { w: 'fill' })
