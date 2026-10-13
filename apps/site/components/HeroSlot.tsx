'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useVisible } from '@/lib/motion'

// Script samples that swap inside the headline every 2050ms. The pill springs to each one's width.
const SAMPLES = [['Aa', false], ['أب', true], ['123', false], ['١٢٣', true], ['AED', false], ['د.إ', true]] as const
const SWAP_MS = 2050

export function HeroSlot() {
  const slot = useRef<HTMLButtonElement>(null)
  const measure = useRef<HTMLSpanElement>(null)
  const [i, setI] = useState(0)
  const [width, setWidth] = useState<number | null>(null)
  const [hold, visible] = useVisible<HTMLSpanElement>()

  const fit = useCallback(() => {
    const m = measure.current, s = slot.current
    if (!m || !s) return
    const em = parseFloat(getComputedStyle(s).fontSize)
    setWidth(Math.max(m.getBoundingClientRect().width + em * 0.5, em * 0.78))
  }, [])

  useLayoutEffect(() => { fit() }, [i, fit])
  useEffect(() => {
    document.fonts?.ready.then(fit)
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [fit])
  useEffect(() => {
    if (!visible || prefersReducedMotion()) return
    const t = setInterval(() => setI((n) => (n + 1) % SAMPLES.length), SWAP_MS)
    return () => clearInterval(t)
  }, [visible, i])

  const [text, arabic] = SAMPLES[i]!
  return (
    <button ref={slot} type="button" className="slot" aria-label="Next script sample" style={width ? { width } : undefined}
      onClick={() => setI((n) => (n + 1) % SAMPLES.length)}>
      <span ref={hold} className="slot-sentinel" aria-hidden="true" />
      <span ref={measure} className={`measure${arabic ? ' ar' : ''}`} lang={arabic ? 'ar' : undefined} aria-hidden="true">{text}</span>
      <span key={i} className={`glyph${arabic ? ' ar' : ''}`} lang={arabic ? 'ar' : undefined}>{text}</span>
    </button>
  )
}
