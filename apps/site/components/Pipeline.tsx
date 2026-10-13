'use client'
import { useEffect, useState } from 'react'
import { prefersReducedMotion, useVisible } from '@/lib/motion'

// The starter pipeline. Click a value in tokens.json and Figma and code follow it; until then it edits itself.
const RADII = [24, 12, 4] as const
const EVERY_MS = 4000
type Dir = 'rtl' | 'ltr'
type Field = 'r' | 'dir'

export function Pipeline() {
  const [ref, visible] = useVisible<HTMLDivElement>()
  const [r, setR] = useState<number>(24)
  const [dir, setDir] = useState<Dir>('rtl')
  const [changed, setChanged] = useState<{ field: Field; n: number }>({ field: 'r', n: 0 })
  const [hover, setHover] = useState<Field | null>(null)
  const [touched, setTouched] = useState(false)

  const nextRadius = () => { setR((x) => RADII[(RADII.indexOf(x as (typeof RADII)[number]) + 1) % RADII.length]!); setChanged((c) => ({ field: 'r', n: c.n + 1 })) }
  const flipDir = () => { setDir((d) => (d === 'rtl' ? 'ltr' : 'rtl')); setChanged((c) => ({ field: 'dir', n: c.n + 1 })) }

  useEffect(() => {
    if (!visible || touched || prefersReducedMotion()) return
    let k = 0
    const t = setInterval(() => { (k++ % 2 === 0 ? nextRadius : flipDir)() }, EVERY_MS)
    return () => clearInterval(t)
  }, [visible, touched])

  const user = (fn: () => void) => () => { setTouched(true); fn() }
  const lit = (field: Field) => hover === field
  const flash = (field: Field) => changed.n > 0 && changed.field === field
  const cls = (field: Field) => ['v', lit(field) && 'lit', flash(field) && 'flash'].filter(Boolean).join(' ')
  const value = (field: Field, text: string, onClick?: () => void) => onClick
    ? <button type="button" key={`${field}-${changed.n}`} className={cls(field)} onClick={onClick} onPointerEnter={() => setHover(field)} onPointerLeave={() => setHover(null)}
        aria-label={field === 'r' ? `Card radius ${r}, click to change` : `Direction ${dir}, click to flip`}>{text}</button>
    : <span key={`${field}-${changed.n}`} className={cls(field)}>{text}</span>

  return (
    <div className="tile pipeline" ref={ref}>
      <div className="pipe-pane">
        <span className="h">tokens.json <span className="hint">click a value</span></span>
        <pre>
          <span>{'{'}</span>
          <span>{'  "radius": {'}</span>
          <span className="hot">{'    "card": '}{value('r', String(r), user(nextRadius))}</span>
          <span>{'  },'}</span>
          <span className="hot">{'  "dir": '}{value('dir', `"${dir}"`, user(flipDir))}</span>
          <span>{'}'}</span>
        </pre>
      </div>
      <div className="pipe-pane">
        <span className="h">Figma</span>
        <div className="pipe-canvas">
          <div>
            <div className="frame-tag">Card · {dir.toUpperCase()} · r {r}</div>
            <div className={`mini${hover === 'r' ? ' lit' : ''}`} dir={dir} style={{ ['--r' as string]: `${r}px`, alignItems: 'flex-start' }}>
              <i style={{ width: 56 }} /><b /><i style={{ width: 96 }} /><u style={{ borderRadius: r / 2 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="pipe-pane">
        <span className="h">Code</span>
        <pre>
          <span className="hot">{'<Card dir='}{value('dir', `"${dir}"`)}{'>'}</span>
          <span>{'  <Amount />'}</span>
          <span>{'  <Pay />'}</span>
          <span>{'</Card>'}</span>
          <span>{' '}</span>
          <span className="hot">{'radius: '}{value('r', `${r}px`)}</span>
        </pre>
      </div>
    </div>
  )
}
