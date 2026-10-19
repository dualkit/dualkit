// Timing for the three How it works cells, all in milliseconds. Pure data so the sequences can be tested and the
// components only turn it into Web Animations keyframes. Values come from docs/plans/2026-10-19-rebrand-motion.md rows 3 to 5.

export const PULSE_MS = 900
export const PULSE_STEP_MS = 300
export const REST_MS = 1200
export const FLASH_MS = 400
export const FLASH_FLOOR = 0.4

export type Pulse = { wire: number; start: number; end: number }
export type Flash = { at: number; end: number }
export type PulseSchedule = { cycle: number; pulses: Pulse[]; flashes: Flash[] }

/** Cell 01: one pulse per wire, each 300 ms after the last, then a rest before the loop repeats. */
export function pulseSchedule(wires = 3): PulseSchedule {
  const pulses = Array.from({ length: wires }, (_, wire) => ({ wire, start: wire * PULSE_STEP_MS, end: wire * PULSE_STEP_MS + PULSE_MS }))
  const last = pulses[pulses.length - 1]?.end ?? 0
  return { cycle: last + REST_MS, pulses, flashes: pulses.map((p) => ({ at: p.end, end: p.end + FLASH_MS })) }
}

/** Node ring opacity at time t: .4 at rest, rising to 1 halfway through each 400 ms flash. Overlapping flashes take the higher one. */
export function ringOpacity(t: number, flashes: Flash[]): number {
  const lift = flashes.reduce((top, f) => {
    const half = (f.end - f.at) / 2
    const d = t - f.at
    return d < 0 || d > f.end - f.at ? top : Math.max(top, 1 - Math.abs(d - half) / half)
  }, 0)
  return FLASH_FLOOR + (1 - FLASH_FLOOR) * lift
}

export type PulseFrame = { offset: number; opacity: number; distance: number; ease?: boolean }

/** Keyframes (offsets 0 to 1 over the cycle) for one dot: hidden, appears at its start, travels the wire, vanishes on arrival. */
export function pulseFrames(s: PulseSchedule, wire: number): PulseFrame[] {
  const p = s.pulses[wire]
  if (!p) return []
  const at = (ms: number) => Math.min(1, ms / s.cycle)
  return [
    { offset: 0, opacity: 0, distance: 0 },
    { offset: at(p.start), opacity: 1, distance: 0, ease: true },
    { offset: at(p.end), opacity: 1, distance: 1 },
    { offset: at(p.end + 1), opacity: 0, distance: 1 },
    { offset: 1, opacity: 0, distance: 1 },
  ]
}

/** Ring keyframes sampled every 50 ms across the cycle. */
export function ringFrames(s: PulseSchedule, stepMs = 50): Array<{ offset: number; opacity: number }> {
  const n = Math.round(s.cycle / stepMs)
  return Array.from({ length: n + 1 }, (_, i) => ({ offset: i / n, opacity: ringOpacity((i * s.cycle) / n, s.flashes) }))
}

export const RANK_EXIT_MS = 150
export const RANK_FLIP_MS = 450
export const RANK_BAR_MS = 600
export const RANK_BAR_STEP_MS = 150
export const RANK_HIGHLIGHT_LAG_MS = 200
export const RANK_HIGHLIGHT_MS = 200

export type RankSchedule = {
  exit: { start: number; end: number }
  slide: { start: number; end: number }
  enter: { start: number; end: number }
  bars: Array<{ start: number; end: number }>
  highlight: { start: number; end: number }
}

/** Cell 02: the top row leaves, the rest move up one slot, it re-enters last; then the bars fill 150 ms apart and row 1 takes the highlight. */
export function rankSchedule(rows = 3): RankSchedule {
  const exit = { start: 0, end: RANK_EXIT_MS }
  const slide = { start: RANK_EXIT_MS, end: RANK_EXIT_MS + RANK_FLIP_MS }
  const enter = { start: slide.end - RANK_EXIT_MS, end: slide.end + RANK_EXIT_MS / 3 }
  const barsAt = enter.end
  const bars = Array.from({ length: rows }, (_, k) => ({ start: barsAt + k * RANK_BAR_STEP_MS, end: barsAt + k * RANK_BAR_STEP_MS + RANK_BAR_MS }))
  const first = bars[0]?.end ?? barsAt
  return { exit, slide, enter, bars, highlight: { start: first + RANK_HIGHLIGHT_LAG_MS, end: first + RANK_HIGHLIGHT_LAG_MS + RANK_HIGHLIGHT_MS } }
}

export const CHECK_LINE_MS = 500
export const CHECK_LINE_STEP_MS = 180
export const CHECK_BLINK_MS = 240
export const CHECK_BUTTON_MS = 300

export type CheckSchedule = {
  lines: Array<{ start: number; end: number }>
  blink: { start: number; end: number }
  button: { start: number; end: number }
}

/** Cell 03: skeleton lines draw 180 ms apart, the score square blinks twice, then Open report goes from dim to solid. */
export function checkSchedule(lines = 3): CheckSchedule {
  const drawn = Array.from({ length: lines }, (_, k) => ({ start: k * CHECK_LINE_STEP_MS, end: k * CHECK_LINE_STEP_MS + CHECK_LINE_MS }))
  const done = drawn[drawn.length - 1]?.end ?? 0
  const blink = { start: done, end: done + 2 * CHECK_BLINK_MS }
  return { lines: drawn, blink, button: { start: blink.end, end: blink.end + CHECK_BUTTON_MS } }
}
