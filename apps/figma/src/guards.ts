import { isSampleKind } from './kinds'
import type { ToMain, ToUi } from './messages'
import type { FillItem, FillLayer } from './samples'

// Checks each message that crosses between the plugin window and the main thread, so neither side acts on a malformed one.
// Malformed items inside a list are dropped; a malformed message is rejected whole.

/** More layers than any one fill needs; beyond this the main thread would stall setting text. */
export const MAX_FILL_ITEMS = 1000
/** Longer than any sample the generator makes. */
export const MAX_FILL_TEXT = 200
const MAX_ID = 200
const MAX_URL = 1000

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null
const isStr = (v: unknown, max = Infinity): v is string => typeof v === 'string' && v.length <= max

const toFillItem = (v: unknown): FillItem[] =>
  isObj(v) && isStr(v.id, MAX_ID) && isSampleKind(v.kind) && isStr(v.text, MAX_FILL_TEXT) ? [{ id: v.id, kind: v.kind, text: v.text }] : []

const toLayer = (v: unknown): FillLayer[] => (isObj(v) && isStr(v.id, MAX_ID) && isStr(v.name) ? [{ id: v.id, name: v.name }] : [])

/** A message from the plugin window, or null when it is not one the main thread handles. */
export function parseToMain(raw: unknown): ToMain | null {
  if (!isObj(raw)) return null
  switch (raw.type) {
    case 'ready': case 'check': case 'fill-request': return { type: raw.type }
    case 'select': return isStr(raw.id, MAX_ID) ? { type: 'select', id: raw.id } : null
    case 'open': return isStr(raw.url, MAX_URL) ? { type: 'open', url: raw.url } : null
    case 'fill-apply':
      return Array.isArray(raw.items) ? { type: 'fill-apply', items: raw.items.slice(0, MAX_FILL_ITEMS).flatMap(toFillItem) } : null
    default: return null
  }
}

const isRoot = (v: unknown): boolean => v === null || (isObj(v) && (v.kind === 'text' || v.kind === 'container'))

/** A message from the main thread, or null when it is not one the plugin window handles. */
export function parseToUi(raw: unknown): ToUi | null {
  if (!isObj(raw)) return null
  switch (raw.type) {
    case 'mode': return raw.mode === 'check' || raw.mode === 'fill' ? { type: 'mode', mode: raw.mode } : null
    case 'snapshot':
      // The snapshot's inner shape is checked by checkFrame, which the panel runs inside a try.
      return isRoot(raw.root) && (raw.note === null || isStr(raw.note))
        ? { type: 'snapshot', root: raw.root as Extract<ToUi, { type: 'snapshot' }>['root'], note: raw.note }
        : null
    case 'fill-layers': return Array.isArray(raw.layers) ? { type: 'fill-layers', layers: raw.layers.flatMap(toLayer) } : null
    case 'filled':
      return typeof raw.filled === 'number' && Array.isArray(raw.skipped)
        ? { type: 'filled', filled: raw.filled, skipped: raw.skipped.filter((s): s is string => isStr(s)) }
        : null
    default: return null
  }
}
