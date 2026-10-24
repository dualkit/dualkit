'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONVERT_COPY } from '@/lib/convert-copy'
import { PROOF_COUNTS } from '@/lib/convert-proof'
import { useSequence } from '@/lib/v3/inview'

const R = CONVERT_COPY.run
const TYPE_MS = 28
/** Pause before each output line, as the real run spaced them out (baseline shots and npm install take the longest). */
const LINE_GAPS = [900, 700, 500, 1300, 500]
/** Which output line each tally lands on: files, edits and strings with the commit, the open items with the last line. */
const TALLIES = [
  { value: PROOF_COUNTS.files, line: 3 },
  { value: PROOF_COUNTS.edits, line: 3 },
  { value: PROOF_COUNTS.convertStrings, line: 3 },
  { value: PROOF_COUNTS.flags, line: 4 },
]
const COUNT_MS = 900
const DONE: { typed: number; lines: number } = { typed: R.command.length, lines: R.output.length }

function Tally({ value, on, label }: { value: number; on: boolean; label: string }) {
  const [shown, setShown] = useState(value)
  const was = useRef(on)
  useLayoutEffect(() => {
    const rising = on && !was.current
    was.current = on
    if (!on) { setShown(0); return }
    if (!rising) { setShown(value); return }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS)
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [on, value])
  return (
    <div className="cv-tally" data-on={on || undefined}>
      <span className="v3-h2 cv-tally-n"><span className="v3-sr">{value}</span><span aria-hidden="true">{shown}</span></span>
      <span className="v3-body cv-tally-what">{label}</span>
    </div>
  )
}

/**
 * The real convert run, replayed: the command types itself, the five lines of output arrive with the run's pauses, and
 * the tallies beside it count up as the commit lands. The server markup is the finished run; reduced motion keeps it.
 */
export function Run() {
  const ref = useRef<HTMLDivElement>(null)
  const { visible, reduced } = useSequence(ref)
  const [state, setState] = useState(DONE)
  const started = useRef(false)
  const timers = useRef<number[]>([])

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setState({ typed: 0, lines: 0 })
    let at = 300
    for (let c = 1; c <= R.command.length; c += 1) {
      at += TYPE_MS
      timers.current.push(window.setTimeout(() => setState((s) => ({ ...s, typed: c })), at))
    }
    LINE_GAPS.forEach((gap, k) => {
      at += gap
      timers.current.push(window.setTimeout(() => setState((s) => ({ ...s, lines: k + 1 })), at))
    })
  }, [])

  useLayoutEffect(() => { if (!reduced && !started.current) setState({ typed: 0, lines: 0 }) }, [reduced])
  useEffect(() => {
    if (!visible || reduced || started.current) return
    started.current = true
    play()
  }, [visible, reduced, play])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const running = state.lines < DONE.lines
  return (
    <div ref={ref} className="cv-run">
      <div className="cv-run-paint v3-painting">
        <div className="cv-term v3-glass">
          <div className="cv-term-head">
            <span className="cv-term-title">{R.term.title}</span>
            <span className="cv-term-state">{running ? R.term.running : R.term.done}</span>
          </div>
          <pre className="cv-term-body v3-mono" aria-label={`${R.command}. ${R.output.join(' ')}`}>
            <span className="cv-term-line"><span className="cv-term-prompt">$ </span>{R.command.slice(0, state.typed)}{state.typed < DONE.typed ? <i className="cv-term-caret" /> : null}</span>
            {R.output.map((line, k) => (
              <span key={line} className="cv-term-line cv-term-out" data-on={k < state.lines || undefined}>{line}</span>
            ))}
          </pre>
          <button type="button" className="cv-term-again" onClick={play} disabled={running}>{R.term.again}</button>
        </div>
      </div>
      <div className="cv-tallies">
        {TALLIES.map((t, k) => <Tally key={k} value={t.value} on={state.lines > t.line} label={R.tallies[k]!} />)}
      </div>
    </div>
  )
}
