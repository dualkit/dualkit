'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronIcon } from '@/components/icons'
import { monthLabel } from '@/lib/bench-view'

/** A pill naming the month. With more than one month it opens a short list of the others; with one it is only a label. */
export function MonthPicker({ month, months }: { month: string; months: readonly string[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  if (months.length < 2) return <span className="bx-month">{monthLabel(month)}</span>
  return (
    <div className="bx-picker" ref={root}>
      <button type="button" className="bx-month" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {monthLabel(month)}<ChevronIcon size={12} className="bx-chev" />
      </button>
      <ul className="bx-months" id={id} data-open={open} inert={!open}>
        {months.map((m) => (
          <li key={m}><Link href={`/bench/${m}`} aria-current={m === month ? 'page' : undefined} onClick={() => setOpen(false)}>{monthLabel(m)}</Link></li>
        ))}
      </ul>
    </div>
  )
}
