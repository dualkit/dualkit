// The product window: Claude Code on the left, the checkout it built on the right, a terminal on top.
import { V2 } from './copy.mjs'
import { LINE, col, hline, icon, row, text, vline } from './parts.mjs'

const dots = () => row('Traffic lights', [0, 1, 2].map((k) => ({ shape: `Light ${k + 1}`, kind: 'ellipse', size: ['size.v2.dot', 'size.v2.dot'], fill: 'color.surface.panel' })), { w: 52, gap: 'space.tight' })
const titlebar = (title) => row('Title bar', [dots(), row('Title wrap', [text(title, 'V2UISmall', { color: 'color.text.soft', name: 'Title' })], { w: 'fill', justify: 'center' }), row('Title spacer', [], { w: 52, h: 'size.v2.dot' })],
  { w: 'fill', align: 'center', pad: { block: 'space.tight', inline: 'space.snug' } })

function chat() {
  const w = V2.window
  const step = ([verb, what], k) => row(`Step ${k + 1}`, [text(verb, 'V2UI', { color: 'color.text.faint' }), text(what, 'V2Mono', { name: 'Step target' })], { gap: 'space.tight', align: 'center' })
  const edited = row('Edit summary', [
    text('PaymentSummary.tsx', 'V2Mono'),
    text(w.diff[0], 'V2Mono', { color: 'color.signal.dot' }),
    text(w.diff[1], 'V2Mono', { color: 'color.text.faint' }),
  ], { w: 'fill', gap: 'space.tight', align: 'center', pad: { block: 'space.tight', inline: 'space.snug' }, radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })
  const top = col('Conversation', [
    row('Prompt', [text(w.prompt, 'V2UI', { w: 'fill', name: 'Prompt text' })], { w: 'fill', pad: { block: 'space.snug', inline: 'space.snug' }, radius: 'radius.media', fill: 'color.surface.page', stroke: LINE }),
    col('Steps', w.steps.slice(0, 2).map(step), { gap: 'space.tight' }),
    edited,
    text(w.reply, 'V2UI', { w: 'fill', name: 'Reply' }),
  ], { w: 'fill', gap: 'space.item' })
  const input = row('Input', [text('Ask Claude to build anything', 'V2UI', { color: 'color.text.faint' })], { w: 'fill', pad: { block: 'space.snug', inline: 'space.snug' }, radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })
  return col('Chat', [top, input], { w: 'size.v2.chat', h: 'fill', justify: 'between', pad: 'space.item', fill: 'color.surface.raised' })
}

function preview() {
  const w = V2.window
  const phone = col('Phone field', [
    row('Phone input', [text('+971', 'V2Mono', { color: 'color.text.faint' }), text('050 123 4567', 'V2Mono', { name: 'Phone value' })],
      { w: 'fill', gap: 'space.tight', pad: { block: 'space.snug', inline: 'space.snug' }, radius: 'radius.media', stroke: { color: 'color.text.primary', width: 'size.stroke', dash: [3, 2] } }),
    row('Inspector tag', [text(w.inspector, 'V2UISmall', { color: 'color.text.inverse' })], { pad: { block: 'space.none', inline: 'space.tight' }, fill: 'color.surface.inverse', abs: { start: 0, top: -18 } }),
  ], { w: 'fill' })
  const card = col('Arabic checkout', [
    text('ملخص الدفع', 'V2ArTitle', { name: 'Title' }),
    col('Amount', [text('المبلغ المستحق', 'V2ArBody', { color: 'color.text.soft' }), text('1,234.50 د.إ', 'V2ArAmount', { name: 'Amount value' })], { gap: 'space.none', align: 'end' }),
    hline('Card rule'),
    row('Due row', [text('1 رمضان 1447 هـ', 'V2ArBody', { name: 'Hijri value' }), text('تاريخ الاستحقاق', 'V2ArBody', { color: 'color.text.soft' })], { w: 'fill', justify: 'between' }),
    col('Phone block', [text('رقم الجوال للإيصال', 'V2ArBody', { color: 'color.text.soft' }), phone], { w: 'fill', gap: 'space.tight', align: 'end' }),
    row('Pay', [text('إتمام الدفع', 'V2ArBody', { color: 'color.text.inverse' })], { w: 'fill', justify: 'center', pad: { block: 'space.snug' }, radius: 'radius.pill', fill: 'color.surface.inverse' }),
  ], { w: 'size.v2.rail', gap: 'space.item', pad: 'space.group', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE, align: 'end' })
  const bar = row('Browser bar', [icon('back', 'color.text.faint'), icon('arrow', 'color.text.faint'),
    row('URL', [text(w.url, 'V2Mono', { color: 'color.text.soft' })], { w: 'fill', pad: { block: 'space.hair', inline: 'space.snug' }, radius: 'radius.pill', fill: 'color.surface.panel' })],
    { w: 'fill', gap: 'space.snug', align: 'center', pad: { block: 'space.tight', inline: 'space.snug' } })
  return col('Preview', [bar, hline('Bar rule'), row('Canvas', [card], { w: 'fill', h: 'fill', justify: 'center', align: 'center', fill: 'color.surface.ground' })], { w: 'fill', h: 'fill' })
}

export function productWindow() {
  return col('App window', [titlebar(V2.window.title), hline('Title rule'), row('Panes', [chat(), vline('Pane rule'), preview()], { w: 'fill', h: 'fill' })],
    { w: 'size.v2.window.w', h: 'size.v2.window.h', radius: 'radius.window', fill: 'color.surface.page', stroke: LINE, clip: true })
}

export function terminal() {
  const lines = V2.window.cli.map((l, k) => text(l, 'V2Mono', { color: l.startsWith('$') ? 'color.text.primary' : 'color.signal.dot', name: `Line ${k + 1}`.replace('Line', 'Output') }))
  return col('Terminal', [titlebar(V2.window.cliTitle), hline('Terminal rule'), col('Output', lines, { w: 'fill', gap: 'space.tight', pad: 'space.item' })],
    { w: 'size.v2.cli.w', radius: 'radius.window', fill: 'color.surface.raised', stroke: LINE, clip: true, abs: { start: 48, bottom: 48 } })
}
