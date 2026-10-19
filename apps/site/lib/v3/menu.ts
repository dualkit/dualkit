// The Products menu's state, and the Bench countdown it shows. Pure, so the tests cover them without a DOM.
import { V3 } from './copy'

export const PART_COUNT = V3.menu.parts.length

export type MenuVia = 'pointer' | 'keyboard'
export type MenuState = { open: boolean; active: number; via: MenuVia | null }
export type MenuEvent =
  | { type: 'toggle'; via: MenuVia }
  | { type: 'close' }
  | { type: 'move'; dir: 1 | -1 }
  | { type: 'hover'; index: number }

export const MENU_CLOSED: MenuState = { open: false, active: 0, via: null }

/** Close keeps `via`, so a menu opened from the keyboard also closes without animation. */
export function menuReducer(state: MenuState, e: MenuEvent): MenuState {
  switch (e.type) {
    case 'toggle':
      return state.open ? { ...MENU_CLOSED, via: e.via } : { open: true, active: 0, via: e.via }
    case 'close':
      return state.open || state.active !== 0 ? { ...MENU_CLOSED, via: state.via } : state
    case 'move':
      return { ...state, active: (state.active + e.dir + PART_COUNT) % PART_COUNT }
    case 'hover':
      return e.index >= 0 && e.index < PART_COUNT && e.index !== state.active ? { ...state, active: e.index } : state
  }
}

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
