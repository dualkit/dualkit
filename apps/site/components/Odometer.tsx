'use client'
import { useInView } from '@/lib/motion'

const DIGITS = '0123456789'

/** Each digit is a 0-9 column, one row per 1em, that rolls into place when the strip scrolls into view. */
export function Odometer({ value }: { value: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  return (
    <span className="figure tnum" ref={ref} aria-label={value}>
      <span className="odo" aria-hidden="true">
        {[...value].map((d, k) => (
          <span className="col" key={k} style={{ transitionDelay: `${k * 80}ms`, transform: seen ? `translateY(-${Number(d)}em)` : undefined }}>
            {[...DIGITS].map((n) => <span key={n}>{n}</span>)}
          </span>
        ))}
      </span>
    </span>
  )
}
