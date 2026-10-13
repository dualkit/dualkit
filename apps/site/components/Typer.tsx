'use client'
import { useEffect, useState } from 'react'
import { prefersReducedMotion, wait } from '@/lib/motion'

// Types 33ms a character, deletes 17ms, holds 3.2s, pauses 530ms between names.
export function Typer({ words }: { words: readonly string[] }) {
  const [text, setText] = useState(words[0] ?? '')
  useEffect(() => {
    if (prefersReducedMotion()) return
    let alive = true
    ;(async () => {
      for (let i = 0; alive; i = (i + 1) % words.length) {
        const word = words[i] ?? ''
        if (i > 0) for (let n = 1; n <= word.length && alive; n++) { setText(word.slice(0, n)); await wait(33) }
        await wait(3200)
        for (let n = word.length; n >= 0 && alive; n--) { setText(word.slice(0, n)); await wait(17) }
        await wait(530)
      }
    })()
    return () => { alive = false }
  }, [words])
  return <div className="typer"><span className="muted">loading </span><span>{text}</span><span className="caret" aria-hidden="true" /></div>
}
