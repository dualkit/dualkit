'use client'
import { useLayoutEffect, useRef, useState } from 'react'

type Option<T> = { value: T; label: string; lang?: string }

/** A pill control whose indicator slides under the pressed option (420ms). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ x: number; w: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const on = root.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      if (on) setBox({ x: on.offsetLeft, w: on.offsetWidth })
    }
    place()
    document.fonts?.ready.then(place)
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [value])

  return (
    <div className="seg" ref={root} role="group" aria-label={label}>
      <span className="ind" style={box ? { width: box.w, transform: `translateX(${box.x}px)` } : undefined} />
      {options.map((o) => (
        <button key={o.value} type="button" lang={o.lang} aria-pressed={o.value === value} onClick={() => o.value !== value && onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
