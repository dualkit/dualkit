import type { FillItem, FillLayer } from './samples'
import type { FigmaSnapshot } from './snapshot-types'

export type Mode = 'check' | 'fill'

/** Main thread to UI. */
export type ToUi =
  | { type: 'mode'; mode: Mode }
  | { type: 'snapshot'; root: FigmaSnapshot | null; note: string | null }
  | { type: 'fill-layers'; layers: FillLayer[] }
  | { type: 'filled'; filled: number; skipped: string[] }

/** UI to main thread. */
export type ToMain =
  | { type: 'ready' }
  | { type: 'check' }
  | { type: 'select'; id: string }
  | { type: 'open'; url: string }
  | { type: 'fill-request' }
  | { type: 'fill-apply'; items: FillItem[] }
