'use client'
import { useEffect, useState } from 'react'
import { COPY } from '@/lib/copy'
import { useInView } from '@/lib/motion'
import { Segmented } from './Segmented'

type Mode = 'without' | 'with'
const OPTIONS = [{ value: 'without', label: 'Without' }, { value: 'with', label: 'With skills' }] as const

/** The baseline card. The Arabic line is rendered by the visitor's browser, so "Without" shows the real reversal. */
export function EvalCard() {
  const s = COPY.skills
  const [mode, setMode] = useState<Mode>('without')
  const [touched, setTouched] = useState(false)
  const [ref, seen] = useInView<HTMLDivElement>()
  useEffect(() => {
    if (!seen || touched) return
    const t = setTimeout(() => setMode('with'), 700)
    return () => clearTimeout(t)
  }, [seen, touched])

  const isolated = mode === 'with'
  return (
    <div className="card" id="evalCard" ref={ref}>
      <div className="card-head">
        <div><h3>{s.evalTitle}</h3><p className="cap" style={{ margin: '4px 0 0' }}>{s.evalNote}</p></div>
        <Segmented label="Skills" options={OPTIONS} value={mode} onChange={(v) => { setTouched(true); setMode(v) }} />
      </div>
      <div className="live">
        <div className="tag"><span>Rendered live by your browser</span><span>{isolated ? 'isolated' : 'not isolated'}</span></div>
        <p dir="rtl" lang="ar">مثال: {isolated ? <bdi dir="ltr">050 123 4567</bdi> : '050 123 4567'}</p>
      </div>
      <div className="score">
        {s.evalRows.map(([label, without, withSkills]) => {
          const v = isolated ? withSkills : without
          return (
            <div className="r" key={label}>
              <span>{label}</span>
              <span className="bar"><i style={{ width: `${(v / 3) * 100}%` }} /></span>
              <span className="v" key={v}><span className="swap-in">{v}/3</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
