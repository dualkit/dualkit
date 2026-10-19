// The kit accordion's state, pure so the tests cover it without a DOM. `open` is the one expanded item; `focus` is the
// item whose button holds keyboard focus. Arrow keys move focus only; Enter or Space (a click) opens. `via` is how the
// last open came about: a keyboard open shows its panel at once, like the Products menu.
import type { MenuVia } from './menu'

export const KIT_OPEN_DEFAULT = 0

export type KitState = { open: number; focus: number; via: MenuVia }
export type KitEvent =
  | { type: 'open'; index: number; via?: MenuVia }
  | { type: 'move'; dir: 1 | -1 }
  | { type: 'edge'; to: 'first' | 'last' }
  | { type: 'focus'; index: number }

export const kitInitial = (): KitState => ({ open: KIT_OPEN_DEFAULT, focus: KIT_OPEN_DEFAULT, via: 'pointer' })

export function kitReducer(state: KitState, e: KitEvent, count: number): KitState {
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count
  switch (e.type) {
    case 'open':
      return valid(e.index) ? { open: e.index, focus: e.index, via: e.via ?? 'pointer' } : state
    case 'focus':
      return valid(e.index) && e.index !== state.focus ? { ...state, focus: e.index } : state
    case 'move':
      return { ...state, focus: (state.focus + e.dir + count) % count }
    case 'edge':
      return { ...state, focus: e.to === 'first' ? 0 : count - 1 }
  }
}

/** The key that moves focus, or null for any other key. */
export function kitKeyEvent(key: string): KitEvent | null {
  switch (key) {
    case 'ArrowDown': return { type: 'move', dir: 1 }
    case 'ArrowUp': return { type: 'move', dir: -1 }
    case 'Home': return { type: 'edge', to: 'first' }
    case 'End': return { type: 'edge', to: 'last' }
    default: return null
  }
}
