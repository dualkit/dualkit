'use client'
import { useInView } from '@/lib/motion'

/** A row of tick marks that fill one by one when scrolled into view (20ms apart). */
export function Ticks({ filled, total = 24 }: { filled: number; total?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.6)
  return (
    <div className="ticks" ref={ref} aria-hidden="true">
      {Array.from({ length: total }, (_, k) => (
        <i key={k} className={seen && k < filled ? 'on' : undefined} style={{ transitionDelay: `${k * 20}ms` }} />
      ))}
    </div>
  )
}
