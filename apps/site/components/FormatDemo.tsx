'use client'
import { useMemo, useState } from 'react'
import { FORMAT_TABS, runTab, type TabId } from '@/lib/format-tabs'
import { CheckIcon } from './icons'

/** The real @dualkit/format, run on every keystroke. */
export function FormatDemo() {
  const [tab, setTab] = useState<TabId>('money')
  const [input, setInput] = useState(FORMAT_TABS[0]!.sample)
  const current = FORMAT_TABS.find((t) => t.id === tab)!
  const result = useMemo(() => runTab(tab, input), [tab, input])

  const pick = (id: TabId) => { setTab(id); setInput(FORMAT_TABS.find((t) => t.id === id)!.sample) }
  return (
    <div className="demo">
      <div className="tabs" role="group" aria-label="Format">
        {FORMAT_TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === tab} onClick={() => pick(t.id)}>{t.name}</button>
        ))}
      </div>
      <div className="input-row">
        <div className="input-label">
          <label htmlFor="fmtInput">{current.label}</label>
          <button type="button" onClick={() => setInput(current.arabicSample)}>Type it in Arabic digits</button>
        </div>
        <input id="fmtInput" autoComplete="off" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="outs" key={tab} aria-live="polite">
        {'error' in result ? (
          <div className="out"><span className="k">Result</span><span className="val"><span className="bad">{result.error}</span></span></div>
        ) : (
          <>
            {result.rows.map((r, k) => (
              <div className="out" key={r.label} style={{ animationDelay: `${k * 40}ms` }}>
                <span className="k">{r.label}</span>
                <span className={`val${r.arabic ? ' ar' : ''}`} lang={r.arabic ? 'ar' : undefined}><bdi>{r.value}</bdi></span>
              </div>
            ))}
            {result.valid && <div className="out"><span className="k">Check</span><span className="val"><span className="ok"><CheckIcon size={14} />Valid</span></span></div>}
          </>
        )}
      </div>
    </div>
  )
}
