// The live layer: when the next monthly run starts, and what the runner's progress file says right now.

import { BENCH_COPY } from './bench-copy'

/**
 * The workflow's schedule, '17 4 1-3 * *': 04:17 UTC on the 1st to the 3rd. The 1st starts the month's run;
 * the 2nd and 3rd finish whatever a deadline left, so a month's run window is 04:17 on the 1st to the end of the 3rd.
 */
const RUN_HOUR = 4
const RUN_MINUTE = 17
const LAST_RUN_DAY = 3
/** The runner pushes progress every 15 minutes; a file older than this means the run has stopped. */
export const STALE_MS = 40 * 60_000
export const POLL_MS = 60_000
// The workflow force-pushes progress to its own branch, so main never takes a commit mid-run.
const PROGRESS_BASE = 'https://raw.githubusercontent.com/dualkit/dualkit/bench-progress/bench/runs'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')
const readTime = (iso: string): Date | null => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The next 04:17 UTC on a 1st that is strictly after `now`. */
export function nextRunAt(now: Date): Date {
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, RUN_HOUR, RUN_MINUTE))
  if (thisMonth.getTime() > now.getTime()) return thisMonth
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, RUN_HOUR, RUN_MINUTE))
}

/** This month's run start while `now` is in its window (04:17 UTC on the 1st to the end of the 3rd), else null. */
export function currentRunWindow(now: Date): Date | null {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, RUN_HOUR, RUN_MINUTE))
  return now.getTime() >= start.getTime() && now.getUTCDate() <= LAST_RUN_DAY ? start : null
}

/** The page polls progress only on the 1st to the 3rd, UTC; the rest of the month there is no file to find. */
export const inPollWindow = (now: Date) => now.getUTCDate() <= LAST_RUN_DAY

/** The empty state's month and run day: this month's while its run window is open, else the next run's. */
export function emptyState(now: Date): { month: string; day: string; inWindow: boolean } {
  const open = currentRunWindow(now)
  const day = open ?? nextRunAt(now)
  return { month: day.toISOString().slice(0, 7), day: runDayLabel(day), inWindow: open !== null }
}

/** Under way only inside the window and while the status line says running; otherwise the day, which is today in the window. */
export const emptyHeading = ({ day, inWindow, running }: { day: string; inWindow: boolean; running: boolean }) =>
  inWindow && running ? BENCH_COPY.empty.running : BENCH_COPY.empty.heading(day)

/** "12d 04:12:33", or "04:12:33" under a day. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(s / 86_400)
  const clock = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return days > 0 ? `${days}d ${clock}` : clock
}

export const runDayLabel = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

/** "1 November, 04:17 UTC". */
export function lastRunLabel(iso: string): string | null {
  const d = readTime(iso)
  return d && `${runDayLabel(d)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

/** "06:41", in UTC. */
export function clockUtc(iso: string): string | null {
  const d = readTime(iso)
  return d && `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export const progressUrl = (now: Date, override?: string) => override || `${PROGRESS_BASE}/${now.toISOString().slice(0, 7)}/progress.json`

export type RecentBuild = {
  at: string; model: string; label: string; by: string; mark: string; screen: string; screenTitle: string
  condition: 'alone' | 'dualkit'; ok: boolean; rulesPassed: number | null; error: string | null
}
export type Progress = { month: string; running: boolean; total: number; done: number; updatedAt: string; recent: RecentBuild[] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const STRINGS = ['at', 'model', 'label', 'by', 'mark', 'screen', 'screenTitle'] as const

function recentBuild(v: unknown): RecentBuild | null {
  if (!isObj(v) || !STRINGS.every((k) => isStr(v[k]))) return null
  if (v.condition !== 'alone' && v.condition !== 'dualkit') return null
  if (typeof v.ok !== 'boolean' || !(v.rulesPassed === null || isNum(v.rulesPassed)) || !(v.error === null || isStr(v.error))) return null
  return {
    at: v.at as string, model: v.model as string, label: v.label as string, by: v.by as string, mark: v.mark as string,
    screen: v.screen as string, screenTitle: v.screenTitle as string, condition: v.condition, ok: v.ok, rulesPassed: v.rulesPassed, error: v.error,
  }
}

/** The runner's progress.json, or null for anything that is not exactly that shape. */
export function parseProgress(raw: unknown): Progress | null {
  if (!isObj(raw) || !isStr(raw.month) || typeof raw.running !== 'boolean' || !isNum(raw.total) || !isNum(raw.done) || !isStr(raw.updatedAt) || !Array.isArray(raw.recent)) return null
  const recent = raw.recent.map(recentBuild)
  if (recent.some((r) => r === null)) return null
  return { month: raw.month, running: raw.running, total: raw.total, done: raw.done, updatedAt: raw.updatedAt, recent: recent as RecentBuild[] }
}

/** Running only while the runner says so and has written in the last 40 minutes. */
export function isRunning(p: Progress | null, now: Date): boolean {
  if (!p?.running) return false
  const updated = readTime(p.updatedAt)
  return !!updated && now.getTime() - updated.getTime() <= STALE_MS
}
