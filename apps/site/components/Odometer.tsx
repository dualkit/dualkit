'use client'
import { useInView } from '@/lib/motion'

const DIGITS = '0123456789'

/** Each digit is a 0-9 column that rolls into place when the strip scrolls into view (420ms). */
export function Odometer({ value }: { value: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  return (
    <span className="figure tnum" ref={ref} aria-label={value}>
      <span className="odo" aria-hidden="true">
        {[...value].map((d, k) => (
          <span className="col" key={k} style={{ transitionDelay: `${k * 60}ms`, transform: seen ? `translateY(-${Number(d) * 1.1}em)` : undefined }}>
            {[...DIGITS].map((n) => <span key={n}>{n}</span>)}
          </span>
        ))}
      </span>
    </span>
  )
}
