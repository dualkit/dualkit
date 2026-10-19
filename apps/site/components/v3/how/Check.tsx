'use client'
import { useRef } from 'react'
import { PvCheck } from '../previews/parts'
import { V3 } from '@/lib/v3/copy'
import { checkSchedule } from '@/lib/v3/how-schedule'
import { EASE_UI, useRun } from './useRun'

const C = V3.kit.previews.check
const WIDTHS = [236, 196, 140]
const SCHEDULE = checkSchedule(WIDTHS.length)
const win = (w: { start: number; end: number }) => ({ delay: w.start, duration: w.end - w.start, fill: 'both' as const })

function build(root: HTMLElement): Animation[] {
  const s = SCHEDULE
  const lines = Array.from(root.querySelectorAll<HTMLElement>('.v3-how-skel'))
  const score = root.querySelector<HTMLElement>('.v3-how-sq')
  const open = root.querySelector<HTMLElement>('.v3-how-open')
  const out = lines.flatMap((l, k) => {
    const w = s.lines[k]
    return w ? [l.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { ...win(w), easing: EASE_UI })] : []
  })
  if (score) out.push(score.animate([{ opacity: 1 }, { opacity: 0.15, offset: 0.25 }, { opacity: 1, offset: 0.5 }, { opacity: 0.15, offset: 0.75 }, { opacity: 1 }], { ...win(s.blink), easing: 'linear' }))
  if (open) out.push(open.animate([{ opacity: 0.35 }, { opacity: 1 }], { ...win(s.button), easing: EASE_UI }))
  return out
}

/** Cell 03: the dualkit check glass panel. Skeleton lines draw, the score square blinks, Open report goes solid. */
export function Check() {
  const ref = useRef<HTMLDivElement>(null)
  useRun(ref, build)
  return (
    <div ref={ref} className="v3-glass v3-how-check">
      <div className="v3-how-check-head">
        <span className="v3-how-check-title"><span className="v3-pv-check-box"><PvCheck /></span><span className="v3-how-title">{C.title}</span></span>
        <span className="v3-how-status"><i className="v3-how-sq is-ok" aria-hidden="true" />{C.score}</span>
      </div>
      <div className="v3-how-skels" aria-hidden="true">
        {WIDTHS.map((w) => <i key={w} className="v3-how-skel" style={{ width: w }} />)}
      </div>
      <div className="v3-how-actions">
        <span className="v3-how-open"><PvCheck />{C.open}</span>
        <span className="v3-how-copy">{C.copy}</span>
      </div>
    </div>
  )
}
