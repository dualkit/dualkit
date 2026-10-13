// The Starter section: one token edit travelling from tokens.json to the Figma library to the code.
// Static here, it shows the state after "Radius 24" and "RTL" are picked in the controls under the panes.
import { COPY } from './copy.mjs'
import { RING, band, col, icon, row, sectionHead, segmented, text } from './kit.mjs'

const paneHead = (title, meta) => row(`${title} pane head`, [
  text(title, 'CodeSmall', { name: 'Pane title' }),
  text(meta, 'CodeSmall', { color: 'color.text.muted', name: 'Pane meta' }),
], { w: 'fill', justify: 'between', pad: { block: 'space.snug', inline: 'space.item' } })

const pane = (title, meta, body) => col(`${title} pane`, [
  paneHead(title, meta),
  { shape: 'Pane rule', kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill: 'color.border.divider' },
  body,
], { w: 'fill', h: 'size.pane', radius: 'radius.inset', fill: 'color.surface.page', stroke: RING, clip: true })

const codeLine = ([indent, value], k, hot) => row(`Code line ${k + 1}`, [
  text(String(k + 1), 'CodeSmall', { color: 'color.text.ghost', name: 'Line number', w: 16 }),
  text(`${'  '.repeat(indent)}${value}`, 'CodeSmall', { name: 'Line code', w: 'fill' }),
], { w: 'fill', gap: 'space.snug', pad: { block: 'space.hair', inline: 'space.tight' }, radius: 'radius.chip', ...(hot ? { fill: 'color.surface.highlight' } : {}) })

function tokensPane(s) {
  const lines = col('Token lines', s.tokens.map((l, k) => codeLine(l, k, s.hotTokens.includes(k))), { w: 'fill', pad: 'space.tight' })
  return pane('tokens.json', s.edited, lines)
}

// A small card drawn the way Figma shows a selected frame: a name tag above, a ring around it.
function figmaPane(s) {
  const bar = (name, w) => ({ shape: name, kind: 'rect', size: [w, 8], fill: 'color.surface.panel' })
  const card = col('Mini card', [
    row('Mini header', [{ shape: 'Mini avatar', kind: 'ellipse', size: [20, 20], fill: 'color.surface.panel' }, bar('Mini title', 72)], { w: 'fill', gap: 'space.tight', align: 'center', justify: 'end' }),
    bar('Mini amount', 120),
    col('Mini lines', [bar('Mini line 1', 140), bar('Mini line 2', 96)], { w: 'fill', gap: 'space.tight', align: 'end' }),
    row('Mini button', [], { w: 'fill', h: 28, radius: 'radius.chip', fill: 'color.surface.inverse' }),
  ], { w: 'size.mini.card', gap: 'space.snug', pad: 'space.item', radius: 'radius.card', fill: 'color.surface.page', stroke: { color: 'color.border.select', width: 'size.stroke' }, align: 'end' })
  const canvas = col('Canvas', [
    row('Frame tag', [text(s.frameTag, 'CodeSmall', { color: 'color.text.secondary' })], { w: 'size.mini.card' }),
    card,
  ], { w: 'fill', h: 'fill', gap: 'space.hair', align: 'center', justify: 'center', fill: 'color.surface.raised' })
  return pane('Figma', s.synced, canvas)
}

function codePane(s) {
  const lines = col('Code lines', s.code.map((l, k) => codeLine(l, k, s.hotCode.includes(k))), { w: 'fill', pad: 'space.tight' })
  return pane('Code', s.synced, lines)
}

const connector = (name) => row(name, [
  { shape: 'Wire', kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill: 'color.border.strong' },
  { shape: 'Pulse', kind: 'ellipse', size: [8, 8], fill: 'color.text.primary' },
  { shape: 'Wire end', kind: 'rect', size: [1, 'size.stroke'], w: 'fill', h: 'size.stroke', fill: 'color.border.strong' },
], { w: 'size.wire', align: 'center' })

function controls(s) {
  const control = ([label, options, active]) => row(`${label} control`, [
    text(label, 'Caption', { color: 'color.text.muted' }),
    segmented(`${label} options`, options, active),
  ], { gap: 'space.snug', align: 'center' })
  return row('Controls', [
    row('Try it', [icon('cursor', 'color.text.secondary'), text(s.tryIt, 'Label', { color: 'color.text.secondary' })], { gap: 'space.tight', align: 'center' }),
    row('Control set', s.controls.map(control), { gap: 'space.stack', align: 'center' }),
    row('Agents chip', [text(s.agents, 'CodeSmall', { color: 'color.text.secondary' })], { pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', stroke: RING }),
  ], { w: 'fill', justify: 'between', align: 'center', pad: { top: 'space.group' } })
}

export function starter() {
  const s = COPY.starter
  const tag = row('Tag', [text(s.tag, 'CodeSmall', { color: 'color.text.secondary' })], { pad: { block: 'space.hair', inline: 'space.tight' }, radius: 'radius.pill', fill: 'color.surface.panel' })
  const panes = row('Pipeline', [tokensPane(s), connector('Wire 1'), figmaPane(s), connector('Wire 2'), codePane(s)], { w: 'fill', align: 'center' })
  const diagram = col('Starter diagram', [panes, controls(s)],
    { w: 'fill', pad: 'space.card', radius: 'radius.card', fill: 'color.surface.raised', stroke: RING })
  return band('Starter', [col('Starter head wrap', [sectionHead(s, [tag])], { w: 'size.text' }), diagram], { pad: { top: 'space.section' }, gap: 'space.head' })
}
