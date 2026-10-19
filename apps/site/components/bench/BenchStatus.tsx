'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Ticks } from '@/components/Ticks'
import { BENCH_COPY } from '@/lib/bench-copy'
import { POLL_MS, clockUtc, formatCountdown, isRunning, nextRunAt, parseProgress, progressUrl, type Progress, type RecentBuild } from '@/lib/bench-live'
import { PROGRESS_TICKS, tickFill } from '@/lib/bench-view'
import { EASE, prefersReducedMotion } from '@/lib/motion'
import { MakerMark } from './MakerMark'

const C = BENCH_COPY.status
const OVERRIDE = process.env.NEXT_PUBLIC_BENCH_PROGRESS_URL
const ENTER_MS = 220

/** Polls the runner's progress file. Any failure reads as between runs; the page never shows an error. */
function useProgress(): Progress | null {
  const [progress, setProgress] = useState<Progress | null>(null)
  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const res = await fetch(progressUrl(new Date(), OVERRIDE), { cache: 'no-store' })
        const next = res.ok ? parseProgress(await res.json()) : null
        if (live) setProgress(next)
      } catch {
        if (live) setProgress(null)
      }
    }
    void load()
    const t = setInterval(load, POLL_MS)
    return () => { live = false; clearInterval(t) }
  }, [])
  return progress
}

/** The current time, once a second, only after mount so the server and the first client render agree. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const keyOf = (b: RecentBuild) => `${b.at}|${b.model}|${b.screen}|${b.condition}`

/** The latest builds, newest first. A new one slides in from the start; the rest glide over to make room. */
function Ticker({ builds, ruleCount }: { builds: readonly RecentBuild[]; ruleCount: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, DOMRect>>(new Map())
  const seen = useRef<Set<string> | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const els = [...root.querySelectorAll<HTMLElement>('[data-k]')]
    const first = seen.current === null
    if (!first && !prefersReducedMotion()) {
      for (const el of els) {
        const k = el.dataset.k ?? ''
        const was = before.current.get(k)
        if (!seen.current!.has(k)) {
          el.animate([{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: ENTER_MS, easing: EASE.odo, fill: 'backwards' })
        } else if (was) {
          const now = el.getBoundingClientRect()
          const dx = was.left - now.left, dy = was.top - now.top
          if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: ENTER_MS, easing: EASE.odo })
        }
      }
    }
    seen.current = new Set(els.map((el) => el.dataset.k ?? ''))
    before.current = new Map(els.map((el) => [el.dataset.k ?? '', el.getBoundingClientRect()]))
  }, [builds])

  // Measure right before React commits new builds, so the glide starts where each item was.
  const keys = builds.map(keyOf).join(',')
  const lastKeys = useRef(keys)
  if (lastKeys.current !== keys && ref.current) {
    before.current = new Map([...ref.current.querySelectorAll<HTMLElement>('[data-k]')].map((el) => [el.dataset.k ?? '', el.getBoundingClientRect()]))
    lastKeys.current = keys
  }

  return (
    <div className="bx-ticker" ref={ref} aria-label="Latest builds">
      {builds.map((b) => (
        <div className="bx-build" key={keyOf(b)} data-k={keyOf(b)}>
          <span className="bx-build-at mono faint">{clockUtc(b.at)}</span>
          <MakerMark mark={b.mark} by={b.by} size={12} />
          <span className="bx-build-model">{b.label}</span>
          <span className="bx-build-what soft">{b.screenTitle}, {b.condition === 'alone' ? 'alone' : 'with Dualkit'}</span>
          <span className={`bx-build-result${b.ok ? '' : ' faint'}`}>{b.ok && b.rulesPassed !== null ? `${b.rulesPassed} of ${ruleCount}` : b.error ?? 'No result'}</span>
        </div>
      ))}
    </div>
  )
}

/** The status line above the board: when the next run starts, or how far the current one has got. */
export function BenchStatus({ lastRun, ruleCount }: { lastRun: string | null; ruleCount: number }) {
  const progress = useProgress()
  const now = useNow()
  const running = !!now && isRunning(progress, now)

  if (running && progress) {
    const { filled, percent } = tickFill(progress.done, progress.total)
    return (
      <div className="bx-live">
        <div className="bx-status">
          <div className="bx-status-start">
            <span className="bx-dot on" aria-hidden="true" />
            <span className="bx-label">{C.running}</span>
            <span className="small soft tnum">{C.builds(progress.done, progress.total)}</span>
          </div>
          <div className="bx-status-end bx-progress" role="progressbar" aria-label="Run progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <Ticks filled={filled} total={PROGRESS_TICKS} />
            <span className="mono soft bx-mono">{percent}%</span>
          </div>
        </div>
        {progress.recent.length > 0 && <Ticker builds={progress.recent} ruleCount={ruleCount} />}
      </div>
    )
  }

  const countdown = now ? formatCountdown(nextRunAt(now).getTime() - now.getTime()) : '00d 00:00:00'
  return (
    <div className="bx-status">
      <div className="bx-status-start">
        <span className="bx-dot" aria-hidden="true" />
        {lastRun && <span className="small soft">{C.lastRun} {lastRun}</span>}
      </div>
      <div className="bx-status-end">
        <span className="small soft">{C.nextRun}</span>
        <span className="mono bx-mono tnum" style={{ visibility: now ? 'visible' : 'hidden' }} aria-live="off">{countdown}</span>
      </div>
    </div>
  )
}
