'use client'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CONVERT_COPY } from '@/lib/convert-copy'
import { useSequence } from '@/lib/v3/inview'

const D = CONVERT_COPY.diff
/** How long each example stays before the next one, while nobody has picked one. */
const DWELL_MS = 6000

/**
 * Four kinds of edit, each with real lines from the TailAdmin commit. While the section is in view the examples step
 * on by themselves, with a bar under the open one; any pick stops that for good. Lines draw in on each change.
 */
export function Diff() {
  const ref = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const { visible, reduced } = useSequence(ref)
  const [open, setOpen] = useState(0)
  const [auto, setAuto] = useState(true)
  const playing = auto && visible && !reduced
  const kind = D.kinds[open]!

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setOpen((k) => (k + 1) % D.kinds.length), DWELL_MS)
    return () => clearTimeout(id)
  }, [playing, open])

  const pick = (k: number) => { setAuto(false); setOpen(k) }
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (open + step + D.kinds.length) % D.kinds.length
    pick(next)
    tabs.current[next]?.focus()
  }

  return (
    <div ref={ref} className="cv-diff">
      <div className="cv-diff-list" role="tablist" aria-label={D.label} aria-orientation="vertical" onKeyDown={onKey}>
        {D.kinds.map((k, i) => (
          <button key={k.title} ref={(el) => { tabs.current[i] = el }} type="button" role="tab" id={`cv-diff-tab-${i}`}
            aria-selected={i === open} aria-controls="cv-diff-panel" tabIndex={i === open ? 0 : -1}
            className="cv-diff-tab" onClick={() => pick(i)}>
            <span className="v3-small cv-diff-no">{`0${i + 1}`}</span>
            <span className="cv-diff-words">
              <span className="cv-diff-title">{k.title}</span>
              <span className="v3-small cv-diff-body">{k.body}</span>
            </span>
            {i === open && playing ? <i key={`bar-${open}`} className="cv-diff-bar" style={{ '--ms': `${DWELL_MS}ms` } as CSSProperties} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div className="cv-code" id="cv-diff-panel" role="tabpanel" aria-labelledby={`cv-diff-tab-${open}`}>
        <div className="cv-code-file v3-mono">{kind.file}</div>
        <div key={open} className="cv-code-lines v3-mono">
          {kind.lines.map(([sign, text], i) => sign === '@'
            ? <div key={i} className="cv-code-file cv-code-file--inner" style={{ '--i': i } as CSSProperties}>{text}</div>
            : (
              <div key={i} className="cv-code-line" data-sign={sign === '+' ? 'add' : 'del'} style={{ '--i': i } as CSSProperties}>
                <span className="cv-code-sign" aria-label={sign === '+' ? 'added' : 'removed'}>{sign}</span>
                <code>{text || ' '}</code>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
