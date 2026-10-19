// v3 building blocks: hard edges, ruled frames with corner ticks, the painting behind frosted glass.
import { ICONS, MARK } from '../icons.mjs'

export const LINE = { color: 'color.v3.line', width: 'size.stroke' }
export const GLASS_LINE = { color: 'color.v3.glassLine', width: 'size.stroke' }
export const text = (characters, style, extra = {}) => ({ text: characters, style, ...extra })
export const row = (name, children, extra = {}) => ({ stack: name, dir: 'row', children, ...extra })
export const col = (name, children, extra = {}) => ({ stack: name, dir: 'col', children, ...extra })
export const icon = (name, tint = 'color.text.primary', size = 'size.icon') => ({ shape: `${name} icon`, kind: 'svg', size: [size, size], svg: ICONS[name], tint })
export const hline = (name = 'Rule', fill = 'color.v3.line') => ({ shape: name, kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill })
export const vline = (name = 'Column rule', fill = 'color.v3.line') => ({ shape: name, kind: 'rect', size: ['size.stroke', 1], w: 'size.stroke', h: 'fill', fill })
export const square = (name, size = 7, fill = 'color.v3.tick') => ({ shape: name, kind: 'rect', size: [size, size], fill })
export const band = (name, children, extra = {}) => row(`${name} band`, [col(name, children, { w: 'size.v2.content', ...extra })], { w: 'fill', justify: 'center' })

export const mark = (name = 'Mark', light = 'color.mark.onPanel', dark = 'color.text.primary') => row(name, [
  { shape: 'Mark start', kind: 'svg', size: [9, 20], svg: MARK.start, tint: dark },
  { shape: 'Mark end', kind: 'svg', size: [9, 20], svg: MARK.end, tint: light },
], { gap: 'space.mark' })

/** Sentence-case section label behind a small ink square, as in the reference. */
export const label = (characters) => row(`${characters} label`, [square('Label square'), text(characters, 'V3Label', { name: 'Label' })], { gap: 'space.snug', align: 'center' })

/** Square buttons: ink, outline, or solid white on glass. */
export function button(characters, kind = 'ink', glyph) {
  const ink = kind === 'ink'
  const onGlass = kind === 'glass'
  const fg = ink ? 'color.text.inverse' : 'color.text.primary'
  return row(`${characters} button`, [
    ...(glyph === 'check' ? [icon('check', fg, 14)] : []),
    text(characters, 'V3Label', { color: fg }),
    ...(glyph === 'arrow' ? [icon('arrow', fg, 14)] : []),
  ], { gap: 'space.tight', align: 'center', justify: 'center', pad: { block: 'space.snug', inline: 'space.group' },
    ...(ink ? { fill: 'color.surface.inverse' } : onGlass ? { fill: 'color.v3.glassButton' } : { stroke: LINE }) })
}

/** Section header: label and headline on the left, the lede (and an action) on the right, bottoms aligned. */
export const header = (name, { label: l, heading, lede, action }) => row(`${name} header`, [
  col(`${name} title`, [label(l), text(heading, 'V3H2', { name: 'Heading' })], { gap: 'space.group' }),
  col(`${name} lede wrap`, [text(lede, 'V3Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' }), ...(action ? [action] : [])], { w: 400, gap: 'space.group' }),
], { w: 'fill', justify: 'between', align: 'end' })

/** A hairline frame with ink ticks on its corners and on each column join, the reference's registration marks. */
export function frame(name, children, { joins = [], dir = 'row', ...extra } = {}) {
  const tick = (n, abs) => ({ ...square(n, 7), abs })
  const ticks = [
    tick('Tick top start', { start: -4, top: -4 }), tick('Tick top end', { end: -4, top: -4 }),
    tick('Tick bottom start', { start: -4, bottom: -4 }), tick('Tick bottom end', { end: -4, bottom: -4 }),
    ...joins.flatMap((x, k) => [tick(`Tick join ${k + 1} top`, { start: x - 4, top: -4 }), tick(`Tick join ${k + 1} bottom`, { start: x - 4, bottom: -4 })]),
  ]
  return { stack: name, dir, children: [...children, ...ticks], w: 'fill', stroke: LINE, ...extra }
}

export const painting = (name, children, extra = {}) => row(name, children, {
  w: 'fill', justify: 'center', align: 'center', clip: true, fill: { type: 'image', image: 'dusk', scaleMode: 'FILL' }, ...extra,
})

export const glass = (name, children, extra = {}) => col(name, children, { fill: 'color.v3.glass', blur: 24, stroke: GLASS_LINE, ...extra })
export const gtext = (characters, style = 'V3Glass', extra = {}) => text(characters, style, { color: 'color.v3.glassText', ...extra })
export const gsoft = (characters, style = 'V3Small', extra = {}) => text(characters, style, { color: 'color.v3.glassSoft', ...extra })

/** A short meter: a track with a white fill, as in the reference's ranked list. */
export const meter = (name, share, width = 48) => row(name, [{ shape: `${name} fill`, kind: 'rect', size: [Math.round(width * share), 3], fill: 'color.v3.glassText' }],
  { w: width, h: 3, fill: 'color.v3.glassLine' })
