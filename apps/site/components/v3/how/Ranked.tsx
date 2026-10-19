'use client'
import { useRef } from 'react'
import { V3 } from '@/lib/v3/copy'
import { rankSchedule } from '@/lib/v3/how-schedule'
import { EASE_EXPO, EASE_ODO, useRun } from './useRun'

const M = V3.how.media
const SHARE = [0.92, 0.66, 0.4]
const ROW_PITCH = 36
const SCHEDULE = rankSchedule(M.ranks.length)

const win = (w: { start: number; end: number }) => ({ delay: w.start, duration: w.end - w.start, fill: 'both' as const })

function build(root: HTMLElement): Animation[] {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('.v3-how-rank'))
  const bars = Array.from(root.querySelectorAll<HTMLElement>('.v3-how-bar'))
  const hi = root.querySelector<HTMLElement>('.v3-how-hi')
  const s = SCHEDULE
  const last = rows[rows.length - 1]
  const rest = rows.slice(0, -1)
  const out: Animation[] = []
  // The row that finishes third starts on top, leaves, and re-enters in its own slot; the others move up one slot.
  if (last) {
    const total = s.enter.end
    const top = `translateY(-${ROW_PITCH * rest.length}px)`
    const at = (ms: number) => ms / total
    out.push(last.animate([
      { offset: 0, transform: top, opacity: 1 },
      { offset: at(s.exit.end), transform: top, opacity: 0, easing: 'linear' },
      { offset: at(s.enter.start), transform: top, opacity: 0 },
      { offset: at(s.enter.start), transform: 'none', opacity: 0, easing: EASE_EXPO },
      { offset: 1, transform: 'none', opacity: 1 },
    ], { duration: total, fill: 'both', easing: 'linear' }))
  }
  rest.forEach((r) => out.push(r.animate([{ transform: `translateY(${ROW_PITCH}px)` }, { transform: 'none' }], { ...win(s.slide), easing: EASE_EXPO })))
  bars.forEach((b, k) => {
    const w = s.bars[k]
    if (w) out.push(b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { ...win(w), easing: EASE_ODO }))
  })
  if (hi) out.push(hi.animate([{ opacity: 0 }, { opacity: 1 }], { ...win(s.highlight), easing: 'linear' }))
  return out
}

/** Cell 02: the "Loaded for this task" glass list. The rows reorder, the bars fill, row 1 takes the highlight. */
export function Ranked() {
  const ref = useRef<HTMLDivElement>(null)
  useRun(ref, build)
  return (
    <div ref={ref} className="v3-glass v3-how-loaded">
      <div className="v3-how-loaded-head">
        <span className="v3-how-title">{M.loaded}</span>
        <span className="v3-how-status"><i className="v3-how-sq" aria-hidden="true" />{M.now}</span>
      </div>
      <ol className="v3-how-ranks">
        {M.ranks.map((name, k) => (
          <li key={name} className="v3-how-rank" style={{ height: ROW_PITCH }}>
            {k === 0 ? <span className="v3-how-hi" aria-hidden="true" /> : null}
            <span className="v3-how-rank-start"><span className="v3-how-soft">{k + 1}</span><span className="v3-mono">{name}</span></span>
            <span className="v3-how-meter" aria-hidden="true"><i className="v3-how-bar" style={{ width: `${Math.round((SHARE[k] ?? 0) * 100)}%` }} /></span>
          </li>
        ))}
      </ol>
    </div>
  )
}
