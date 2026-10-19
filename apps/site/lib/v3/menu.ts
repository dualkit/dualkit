// The Products menu's state, and the Bench countdown it shows. Pure, so the tests cover them without a DOM.
import { V3 } from './copy'

export const PART_COUNT = V3.menu.parts.length

export type MenuVia = 'pointer' | 'keyboard'
/**
 * `via`: how the menu was opened (it decides the open and close animation and whether leaving closes it).
 * `step`: how the active row last changed. Keyboard steps repeat many times in a row, so they move the preview at once.
 * `away`: the mouse has left the nav and the drawer; the menu closes if it stays away for LEAVE_MS.
 */
export type MenuState = { open: boolean; active: number; via: MenuVia | null; step: MenuVia; away: boolean }
export type MenuEvent =
  | { type: 'toggle'; via: MenuVia }
  | { type: 'close' }
  | { type: 'move'; dir: 1 | -1 }
  | { type: 'hover'; index: number; via: MenuVia }
  | { type: 'away' }
  | { type: 'back' }
  | { type: 'away-elapsed' }

export const MENU_CLOSED: MenuState = { open: false, active: 0, via: null, step: 'pointer', away: false }

/** How long the mouse may be outside the nav and the drawer before a pointer-opened menu closes. */
export const LEAVE_MS = 300

/** Close keeps `via`, so a menu opened from the keyboard also closes without animation. */
export function menuReducer(state: MenuState, e: MenuEvent): MenuState {
  switch (e.type) {
    case 'toggle':
      return state.open ? { ...MENU_CLOSED, via: e.via, step: e.via } : { open: true, active: 0, via: e.via, step: e.via, away: false }
    case 'close':
      return state.open || state.active !== 0 ? { ...MENU_CLOSED, via: state.via, step: state.step } : state
    // Leaving only counts for a menu the pointer opened; a keyboard-opened menu stays until Escape, a click or a scroll.
    case 'away':
      return state.open && state.via === 'pointer' && !state.away ? { ...state, away: true } : state
    case 'back':
      return state.away ? { ...state, away: false } : state
    case 'away-elapsed':
      return state.open && state.away ? { ...MENU_CLOSED, via: state.via, step: state.step } : state
    case 'move':
      return { ...state, active: (state.active + e.dir + PART_COUNT) % PART_COUNT, step: 'keyboard' }
    // Focus moved by Tab is a keyboard step; a pointer entering a row is a pointer step. A row that is already active stays put.
    case 'hover':
      return e.index >= 0 && e.index < PART_COUNT && e.index !== state.active ? { ...state, active: e.index, step: e.via } : state
  }
}

export type Box = { left: number; top: number; right: number; bottom: number }

/** Whether a point (viewport px) is inside any of the boxes, edges included. */
export const insideAny = (x: number, y: number, boxes: readonly Box[]): boolean =>
  boxes.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)

/** The Bench runs at 04:17 UTC on the 1st of each month (.github/workflows/bench.yml; the 2nd and 3rd are retries). */
const RUN_HOUR = 4
const RUN_MINUTE = 17
const DAY_MS = 86_400_000

/** The next run that has not started yet: this month's when it is still before 04:17 on the 1st, otherwise next month's. */
export function nextBenchRun(now: Date): Date {
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, RUN_HOUR, RUN_MINUTE))
  return thisMonth.getTime() > now.getTime()
    ? thisMonth
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, RUN_HOUR, RUN_MINUTE))
}

/** Whole days left, never below 1, so the last evening reads "in 1 day" rather than "in 0 days". */
export const daysUntil = (then: Date, now: Date): number => Math.max(1, Math.floor((then.getTime() - now.getTime()) / DAY_MS))

export const benchCountdown = (days: number): string => `Next run in ${days} ${days === 1 ? 'day' : 'days'}`
