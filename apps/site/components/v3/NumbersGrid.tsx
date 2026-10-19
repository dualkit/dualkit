'use client'
import { useRef, useState } from 'react'
import { odometerColumns } from '@/lib/v3/odometer'
import { useSequence } from '@/lib/v3/inview'

const STEP_MS = 70

function Rolling({ value, order }: { value: string; order: number }) {
  const cols = odometerColumns('0', value)
  return (
    <>
      <span className="v3-sr">{value}</span>
      <span className="v3-odo" aria-hidden="true">
        {cols.map((c, i) => c.toDigit === null
          ? <span key={i} className="v3-odo-sep">{c.char}</span>
          : (
            <span key={i} className="v3-odo-col">
              <span className="v3-odo-strip" style={{ '--f': c.fromDigit ?? 0, '--t': c.toDigit, '--d': `${(order * 4 + (cols.length - 1 - i)) * STEP_MS / 4}ms` } as React.CSSProperties}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <span key={d}>{d}</span>)}
              </span>
            </span>
          ))}
      </span>
    </>
  )
}

/** The four counters. The markup always holds the final number; once 35% in view the digits roll over it, once. Reduced motion never starts the roll. */
export function NumbersGrid({ stats }: { stats: { value: string; what: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { visible, reduced } = useSequence(ref)
  const [rolled, setRolled] = useState(false)
  if (visible && !reduced && !rolled) setRolled(true)
  return (
    <div ref={ref} className="v3-num-grid">
      {stats.map((s, i) => (
        <div key={s.what} className="v3-num-cell">
          <span className="v3-display v3-num-value">{rolled ? <Rolling value={s.value} order={i} /> : s.value}</span>
          <span className="v3-body v3-num-what">{s.what}</span>
        </div>
      ))}
    </div>
  )
}
