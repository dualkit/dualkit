'use client'
import { useRef } from 'react'
import { Mark } from '@/components/icons'
import { WORKS_WITH } from '@/lib/marks'
import { pulseFrames, pulseSchedule, ringFrames } from '@/lib/v3/how-schedule'
import { EASE_UI, useRun } from './useRun'

const CHIPS = ['Claude Code', 'Cursor', 'shadcn'].map((name) => WORKS_WITH.find((w) => w.name === name)).filter((w) => !!w)
/** Wire paths on the 56 by 104 grid: the chips join at x 20, then one line runs into the node at y 52. */
const WIRES = ['M0 12H20V52H56', 'M0 52H56', 'M0 92H20V52H56']
const SCHEDULE = pulseSchedule(WIRES.length)

function build(root: HTMLElement): Animation[] {
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.v3-how-dot'))
  const ring = root.querySelector<HTMLElement>('.v3-how-ring')
  const base = { duration: SCHEDULE.cycle, iterations: Infinity, easing: 'linear' } as const
  const moving = dots.map((dot, i) =>
    dot.animate(
      pulseFrames(SCHEDULE, i).map((f) => ({ offset: f.offset, opacity: f.opacity, offsetDistance: `${f.distance * 100}%`, ...(f.ease ? { easing: EASE_UI } : {}) })),
      base,
    ),
  )
  const flash = ring ? [ring.animate(ringFrames(SCHEDULE), base)] : []
  return [...moving, ...flash]
}

/** Cell 01: three tool chips, white wires, and pulses running into the Dualkit node. */
export function Connect() {
  const ref = useRef<HTMLDivElement>(null)
  useRun(ref, build)
  return (
    <div ref={ref} className="v3-how-connect">
      <div className="v3-how-chips">
        {CHIPS.map((c) => (
          <div key={c.name} className="v3-glass v3-how-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={c.path} /></svg>
            <span>{c.name}</span>
          </div>
        ))}
      </div>
      <div className="v3-how-wires" aria-hidden="true">
        <svg width="56" height="104" viewBox="0 0 56 104" fill="none">
          <path d="M0 12H20V92H0M0 52H56" stroke="#fff" strokeWidth="1" />
          <rect x="52" y="50" width="4" height="4" fill="#fff" />
        </svg>
        {WIRES.map((d, i) => <span key={d} className="v3-how-dot" style={{ offsetPath: `path('${d}')` }} data-wire={i} />)}
      </div>
      <div className="v3-how-node" role="img" aria-label="Dualkit">
        <span className="v3-how-ring" />
        <span className="v3-how-node-sq"><Mark /></span>
      </div>
    </div>
  )
}
