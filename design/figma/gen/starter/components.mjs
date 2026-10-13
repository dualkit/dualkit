// The eight Starter components as figma-render component specs. Each set has an English (LTR) and an Arabic (RTL) row.
import { COPY as C } from './copy.mjs'
import { FOCUS, LINE, SCRIPTS, col, forward, icon, rect, row, style, text, variant } from './parts.mjs'

const grid = (rows, columns) => ({ rows, columns, gap: 'space.stack.lg', pad: 'space.stack.lg' })
const each = (axis, fn) => SCRIPTS.flatMap((s) => axis.flatMap((a) => [].concat(fn(s, a))))

/** The button's own tree, shared by the set and by the Sheet footer. */
export function buttonBody(s, kind, state, label, withIcon = true) {
  return {
    dir: 'row', gap: 'space.inline.sm', align: 'center', radius: 'radius.control',
    pad: { block: 'space.inline.md', inline: 'space.stack.lg' },
    fill: kind === 'Primary' ? 'color.surface.inverse' : 'color.surface.raised',
    ...(kind === 'Secondary' ? { stroke: LINE } : {}),
    // Focus is an offset ring, as in code: a ground-coloured gap, then the ink ring. Zero blur, so it reads as a line, not a shadow.
    ...(state === 'Focus' ? { clip: true, shadow: [{ spread: 4, color: 'color.border.focus' }, { spread: 2, color: 'color.surface.ground' }] } : {}),
    ...(state === 'Disabled' ? { opacity: 0.4 } : {}),
    children: [
      text(label, style(s, 'Label'), { name: 'Label', color: kind === 'Primary' ? 'color.text.inverse' : 'color.text.primary' }),
      ...(withIcon ? [icon(forward(s), kind === 'Primary' ? 'color.text.inverse' : 'color.text.primary', 'Icon')] : []),
    ],
  }
}

export function button() {
  const one = (s, kind, state) => variant(s, { Variant: kind, State: state }, buttonBody(s, kind, state, C.button[kind.toLowerCase()][s]))
  return {
    component: 'Button', textColor: 'color.text.primary',
    boolProps: { 'Has icon': { layer: 'Icon', default: true } },
    setLayout: grid(['Script', 'Variant'], 'State'),
    variants: SCRIPTS.flatMap((s) => ['Primary', 'Secondary'].flatMap((k) => ['Default', 'Focus', 'Disabled'].map((st) => one(s, k, st)))),
  }
}

export function field() {
  const one = (s, state) => {
    const f = C.field
    const value = state === 'Empty' ? text(f.placeholder, 'En/Body', { name: 'Value', color: 'color.text.tertiary' })
      : text(state === 'Focus' ? f.typing : f.value, 'En/Body', { name: 'Value' })
    const box = row('Box', [value, ...(state === 'Focus' ? [rect('Caret', 1, 20, 'color.text.primary')] : [])], {
      ltr: true, w: 'fill', align: 'center', gap: 1, radius: 'radius.surface', fill: 'color.surface.raised',
      pad: { block: 'space.inline.md', inline: 'space.inline.lg' },
      stroke: state === 'Error' ? { color: 'color.state.danger', width: 1 } : state === 'Focus' ? FOCUS : LINE,
    })
    const note = state === 'Error' ? text(f.error[s], style(s, 'Caption'), { name: 'Help', color: 'color.state.danger', w: 'fill' })
      : text(f.help[s], style(s, 'Caption'), { name: 'Help', color: 'color.text.secondary', w: 'fill' })
    return variant(s, { State: state }, { dir: 'col', w: 320, gap: 'space.stack.sm', align: 'start', children: [text(f.label[s], style(s, 'Label'), { name: 'Label' }), box, note] })
  }
  return { component: 'Field', textColor: 'color.text.primary', setLayout: grid('Script', 'State'), variants: each(['Empty', 'Filled', 'Focus', 'Error'], one) }
}

export function digits() {
  const d = C.digits
  const one = (s, state) => {
    const chars = [...d.value[s]]
    const filled = state === 'Empty' ? 0 : state === 'Typing' ? 3 : 6
    const boxes = chars.map((ch, k) => col(`Digit ${k + 1}`, k < filled ? [text(ch, s === 'Ar' ? 'Ar/Title' : 'Mono/Digit', { name: 'Digit' })] : [], {
      w: 44, h: 52, align: 'center', justify: 'center', radius: 'radius.surface', fill: 'color.surface.raised',
      stroke: state === 'Error' ? { color: 'color.state.danger', width: 1 } : k === filled && state === 'Typing' ? FOCUS : LINE,
    }))
    const note = state === 'Error' ? text(d.error[s], style(s, 'Caption'), { name: 'Help', color: 'color.state.danger' })
      : row('Help', [text(d.sent[s], style(s, 'Caption'), { color: 'color.text.secondary', name: 'Sent to' }), text(s === 'Ar' ? `\u200e${d.phone}` : d.phone, 'En/Caption', { color: 'color.text.secondary', name: 'Phone' })], { gap: 'space.inline.xs' })
    return variant(s, { State: state }, { dir: 'col', gap: 'space.stack.sm', align: 'start', children: [
      text(d.label[s], style(s, 'Label'), { name: 'Label' }),
      row('Boxes', boxes, { ltr: true, gap: 'space.inline.sm' }),
      note,
    ] })
  }
  return { component: 'Digit input', textColor: 'color.text.primary', setLayout: grid('Script', 'State'), variants: each(['Empty', 'Typing', 'Complete', 'Error'], one) }
}

export function amount() {
  const a = C.amount
  const one = (s, cur) => variant(s, { Currency: cur }, { dir: 'col', gap: 'space.stack.xs', align: 'start', children: [
    text(a.label[s], style(s, 'Caption'), { name: 'Label', color: 'color.text.secondary' }),
    text(a[cur][s], style(s, 'Heading'), { name: 'Figure' }),
    text(a.vat[s], style(s, 'Caption'), { name: 'Note', color: 'color.text.tertiary' }),
  ] })
  return { component: 'Amount', textColor: 'color.text.primary', setLayout: grid('Script', 'Currency'), variants: each(['AED', 'SAR'], one) }
}

export function date() {
  const t = C.date
  const one = (s, cal) => {
    const [first, second] = cal === 'Gregorian' ? [t.gregorian, t.hijri] : [t.hijri, t.gregorian]
    const box = row('Box', [
      icon('calendar', 'color.text.secondary', 'Calendar'),
      col('Dates', [text(first[s], style(s, 'Body'), { name: 'Primary' }), text(second[s], style(s, 'Caption'), { name: 'Secondary', color: 'color.text.secondary' })], { w: 'fill', align: 'start' }),
    ], { w: 'fill', gap: 'space.inline.md', align: 'center', radius: 'radius.surface', fill: 'color.surface.raised', stroke: LINE, pad: { block: 'space.inline.md', inline: 'space.inline.lg' } })
    return variant(s, { Calendar: cal }, { dir: 'col', w: 320, gap: 'space.stack.sm', align: 'start', children: [
      text(t.label[s], style(s, 'Label'), { name: 'Label' }), box,
      text(t.zone[s], style(s, 'Caption'), { name: 'Zone', color: 'color.text.tertiary' }),
    ] })
  }
  return { component: 'Date', textColor: 'color.text.primary', setLayout: grid('Script', 'Calendar'), variants: each(['Gregorian', 'Hijri'], one) }
}

export function tabs() {
  const one = (s, active) => {
    const on = ['First', 'Second', 'Third'].indexOf(active)
    const tab = (label, k) => col(`Tab ${k + 1}`, [
      col('Tab label', [text(label, style(s, 'Label'), { name: 'Label', color: k === on ? 'color.text.primary' : 'color.text.secondary' })], { pad: { block: 'space.inline.md', inline: 'space.inline.lg' } }),
      row('Indicator', [], { w: 'fill', h: 2, fill: 'color.border.focus', ...(k === on ? {} : { opacity: 0 }) }),
    ], { align: 'center' })
    return variant(s, { Active: active }, { dir: 'col', children: [
      row('Tab row', C.tabs[s].map(tab), { gap: 'space.inline.xs' }),
      rect('Rule', 1, 1, 'color.border.subtle', { w: 'fill', h: 1 }),
    ] })
  }
  return { component: 'Tabs', textColor: 'color.text.primary', setLayout: grid('Script', 'Active'), variants: each(['First', 'Second'], one) }
}

export function sheet() {
  const h = C.sheet
  const one = (s) => {
    const kv = ([k, v], i) => row(`Row ${i + 1}`, [
      text(k, style(s, 'Body'), { name: 'Key', color: 'color.text.secondary' }),
      text(v, /^[A-Z0-9 -]+$/.test(v) ? 'Mono/Label' : style(s, 'Body'), { name: 'Value' }),
    ], { w: 'fill', justify: 'between', align: 'center' })
    const btn = (kind, label) => ({ stack: kind === 'Primary' ? 'Pay' : 'Cancel', ...buttonBody(s, kind, 'Default', label, kind === 'Primary') })
    return variant(s, {}, { dir: 'col', w: 400, radius: 'radius.surface', fill: 'color.surface.raised', stroke: LINE, clip: true, children: [
      row('Header', [text(h.title[s], style(s, 'Title'), { name: 'Title' }), col('Close', [icon('close', 'color.text.secondary', 'Close icon')], { w: 32, h: 32, align: 'center', justify: 'center', radius: 'radius.control', stroke: LINE })],
        { w: 'fill', justify: 'between', align: 'center', pad: { block: 'space.stack.md', inline: 'space.inset.surface' } }),
      rect('Header rule', 1, 1, 'color.border.subtle', { w: 'fill', h: 1 }),
      col('Body', h.rows[s].map(kv), { w: 'fill', gap: 'space.stack.md', pad: 'space.inset.surface' }),
      rect('Footer rule', 1, 1, 'color.border.subtle', { w: 'fill', h: 1 }),
      row('Footer', [btn('Secondary', h.cancel[s]), btn('Primary', h.pay[s])], { w: 'fill', justify: 'end', gap: 'space.inline.sm', pad: { block: 'space.stack.md', inline: 'space.inset.surface' } }),
    ] })
  }
  return { component: 'Sheet', textColor: 'color.text.primary', setLayout: { wrap: true, width: 960, gap: 'space.stack.lg', pad: 'space.stack.lg' }, variants: SCRIPTS.map(one) }
}

export function toast() {
  const t = C.toast
  const glyph = { Neutral: 'info', Success: 'check', Error: 'alert' }
  const one = (s, tone) => variant(s, { Tone: tone }, {
    dir: 'row', w: 400, gap: 'space.inline.md', align: 'center', radius: 'radius.surface', fill: 'color.surface.inverse',
    pad: { block: 'space.inline.md', inline: 'space.inline.lg' },
    children: [
      icon(glyph[tone], 'color.text.inverse', 'Icon'),
      text(t[tone][s], style(s, 'Body'), { name: 'Message', color: 'color.text.inverse', w: 'fill' }),
      text(t.undo[s], style(s, 'Label'), { name: 'Action', color: 'color.text.inverse' }),
    ],
  })
  return { component: 'Toast', textColor: 'color.text.primary', setLayout: grid('Script', 'Tone'), variants: each(['Neutral', 'Success', 'Error'], one) }
}

export const SETS = { button, field, digits, amount, date, tabs, sheet, toast }
