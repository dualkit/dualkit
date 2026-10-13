'use client'
import { EASE, prefersReducedMotion } from '@/lib/motion'

// Every letter is a button that mirrors itself with a spring. Dualkit, in both directions.
export function Wordmark() {
  const flip = (el: HTMLButtonElement) => {
    const flipped = el.dataset.flipped !== 'true'
    el.dataset.flipped = String(flipped)
    const to = flipped ? -1 : 1
    if (prefersReducedMotion()) { el.style.transform = `scaleX(${to})`; return }
    el.animate([{ transform: `scaleX(${-to})` }, { transform: `scaleX(${to * 1.06})`, offset: 0.55 }, { transform: `scaleX(${to * 0.98})`, offset: 0.8 }, { transform: `scaleX(${to})` }],
      { duration: 620, easing: EASE.expo, fill: 'forwards' })
  }
  return (
    <div className="wordmark" aria-label="Dualkit">
      {[...'Dualkit'].map((ch, k) => (
        <button key={k} type="button" className={k > 3 ? 'k' : undefined} aria-label={`Mirror the letter ${ch}`} onClick={(e) => flip(e.currentTarget)}>{ch}</button>
      ))}
    </div>
  )
}
