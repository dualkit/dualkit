// Starter building blocks. Arabic variants are mirrored here, because a figma-render spec takes one direction for the whole set.

export const SCRIPTS = ['En', 'Ar']
export const style = (s, role) => `${s}/${role}`
export const text = (characters, st, extra = {}) => ({ text: characters, style: st, ...extra })
export const row = (name, children, extra = {}) => ({ stack: name, dir: 'row', children, ...extra })
export const col = (name, children, extra = {}) => ({ stack: name, dir: 'col', children, ...extra })
export const rect = (name, w, h, fill, extra = {}) => ({ shape: name, kind: 'rect', size: [w, h], fill, ...extra })
export const LINE = { color: 'color.border.subtle', width: 1 }
export const FOCUS = { color: 'color.border.focus', width: 2 }
export const pin = (s) => ({ Script: s.toLowerCase() })

const PATHS = {
  arrow: 'M3 8h10M9.5 4.5L13 8l-3.5 3.5',
  back: 'M13 8H3M7.5 3.5L3 8l4.5 4.5',
  close: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
  check: 'M3.5 8.5l3 3 6-7',
  calendar: 'M3 4h10v9H3zM3 6.75h10M5.75 2.5v3M10.25 2.5v3',
  alert: 'M8 5v3.5M8 10.75v.25M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
  info: 'M8 7.25v4M8 5v.25M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z',
}
const svg = (d) => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
/** A 16px icon. Directional ones are passed already flipped by the caller. */
export const icon = (name, tint = 'color.text.primary', layer) => ({ shape: layer ?? `${name} icon`, kind: 'svg', size: [16, 16], svg: svg(PATHS[name]), tint })
/** The arrow that points to where reading goes next. */
export const forward = (s) => (s === 'Ar' ? 'back' : 'arrow')

/** Strip invisible bidi controls: Figma draws them as boxes. The coded component keeps them. */
export const clean = (str) => str.replace(/[⁦-⁩‎‏]/g, '')

const flip = { start: 'end', end: 'start' }
const swap = (o, a, b) => {
  if (!o || typeof o !== 'object') return o
  const out = { ...o }
  if (a in o || b in o) { delete out[a]; delete out[b]; if (a in o) out[b] = o[a]; if (b in o) out[a] = o[b] }
  return out
}

/** Mirror a node for right to left: rows reverse, start and end trade places. Nodes marked ltr stay as they are. */
export function mirror(node) {
  if (node.ltr) { const { ltr, ...rest } = node; return rest }
  const out = { ...node }
  if (out.pad && typeof out.pad === 'object') out.pad = swap(out.pad, 'start', 'end')
  if (out.text !== undefined) {
    // A full-width line starts at the right in Arabic; a hugging one is placed by its parent.
    const align = out.align ?? (out.w === 'fill' ? 'start' : undefined)
    if (align && flip[align]) out.align = flip[align]
    return out
  }
  if (out.dir === 'row') {
    if (out.justify && flip[out.justify]) out.justify = flip[out.justify]
  } else if (out.dir === 'col' && out.align && flip[out.align]) out.align = flip[out.align]
  if (Array.isArray(out.radius)) { const [tl, tr, br, bl] = out.radius; out.radius = [tr, tl, bl, br] }
  if (out.children) {
    const kids = out.children.map(mirror)
    out.children = out.dir === 'row' ? kids.reverse() : kids
  }
  return out
}

/** Strip the ltr marks from an English tree, so the spec only carries keys figma-render knows. */
export function unmark(node) {
  const { ltr, ...rest } = node
  return rest.children ? { ...rest, children: rest.children.map(unmark) } : rest
}

/** One variant: English as built, Arabic mirrored, each pinned to its Script mode. */
export const variant = (s, props, body) => {
  const pinned = { ...body, modes: { ...(body.modes ?? {}), ...pin(s) } }
  return { props: { Script: s, ...props }, ...(s === 'Ar' ? mirror(pinned) : unmark(pinned)) }
}
