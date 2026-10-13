'use client'
import { useEffect, useState } from 'react'
import { prefersReducedMotion, useVisible } from '@/lib/motion'

// The starter pipeline edits itself every four seconds: one token changes, and Figma and code follow it.
const STATES = [{ r: 24, dir: 'rtl' }, { r: 12, dir: 'rtl' }, { r: 12, dir: 'ltr' }, { r: 24, dir: 'ltr' }] as const
const EVERY_MS = 4000

export function Pipeline() {
  const [ref, visible] = useVisible<HTMLDivElement>()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!visible || prefersReducedMotion()) return
    const t = setInterval(() => setI((n) => (n + 1) % STATES.length), EVERY_MS)
    return () => clearInterval(t)
  }, [visible])
  const s = STATES[i]!
  const prev = STATES[(i + STATES.length - 1) % STATES.length]!
  const changed = s.r !== prev.r ? 'r' : 'dir'
  const line = (text: string, hot: boolean, flash: boolean, k: number) => <span key={`${k}-${text}`} className={flash ? 'flash' : hot ? 'hot' : undefined}>{text}</span>
  return (
    <div className="tile pipeline" ref={ref}>
      <div className="pipe-pane">
        <span className="h">tokens.json</span>
        <pre>{['{', '  "radius": {', `    "card": ${s.r}`, '  },', `  "dir": "${s.dir}"`, '}'].map((t, k) => line(t, k === 2 || k === 4, (changed === 'r' && k === 2) || (changed === 'dir' && k === 4), k))}</pre>
      </div>
      <div className="pipe-pane">
        <span className="h">Figma</span>
        <div className="pipe-canvas">
          <div>
            <div className="frame-tag">Card · {s.dir.toUpperCase()} · r {s.r}</div>
            <div className="mini" dir={s.dir} style={{ ['--r' as string]: `${s.r}px`, alignItems: 'flex-start' }}>
              <i style={{ width: 56 }} /><b /><i style={{ width: 96 }} /><u style={{ borderRadius: s.r / 2 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="pipe-pane">
        <span className="h">Code</span>
        <pre>{[`<Card dir="${s.dir}">`, '  <Amount />', '  <Pay />', '</Card>', '', `radius: ${s.r}px`].map((t, k) => line(t, k === 0 || k === 5, (changed === 'dir' && k === 0) || (changed === 'r' && k === 5), k))}</pre>
      </div>
    </div>
  )
}
