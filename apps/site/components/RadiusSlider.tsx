'use client'
import { useEffect, useRef, useState } from 'react'

/** A slider that tracks the pointer 1:1, with keyboard steps. onCommit fires on release. */
export function RadiusSlider({ value, max, onStart, onChange, onCommit }: {
  value: number; max: number; onStart: () => void; onChange: (v: number) => void; onCommit: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const keyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const commit = useRef(onCommit)
  commit.current = onCommit
  useEffect(() => () => clearTimeout(keyTimer.current), [])
  const fromX = (x: number) => {
    const b = root.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (x - b.left) / b.width)) * max)
  }
  const stop = () => { if (!dragging) return; setDragging(false); commit.current() }
  const pct = (value / max) * 100
  return (
    <div ref={root} className={`slider${dragging ? ' dragging' : ''}`} role="slider" tabIndex={0} aria-label="Card radius"
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} pixels`} aria-orientation="horizontal"
      onPointerDown={(e) => { setDragging(true); onStart(); e.currentTarget.setPointerCapture(e.pointerId); onChange(fromX(e.clientX)) }}
      onPointerMove={(e) => { if (dragging) onChange(fromX(e.clientX)) }}
      onPointerUp={stop} onPointerCancel={stop}
      onKeyDown={(e) => {
        const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4, Home: -max, End: max }
        const step = steps[e.key]
        if (step === undefined) return
        e.preventDefault()
        if (!keyTimer.current) onStart()
        onChange(Math.min(max, Math.max(0, value + step)))
        clearTimeout(keyTimer.current)
        keyTimer.current = setTimeout(() => { keyTimer.current = undefined; commit.current() }, 250)
      }}>
      <span className="track" /><span className="fill" style={{ width: `${pct}%` }} /><span className="thumb" style={{ insetInlineStart: `${pct}%` }} />
      <span className="ticks"><span>0</span><span>8</span><span>16</span><span>24</span><span>32</span></span>
    </div>
  )
}
