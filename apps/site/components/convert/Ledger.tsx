'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONVERT_COPY } from '@/lib/convert-copy'
import { PROOF_COUNTS } from '@/lib/convert-proof'
import { useSequence } from '@/lib/v3/inview'

const L = CONVERT_COPY.ledger
const CHAR_MS = 55
const ROW_GAP_MS = 260
/** Arabic is typed by grapheme, so a letter and its marks arrive together. */
const graphemes = (s: string) => Array.from(new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(s), (g) => g.segment)
const ROWS = L.rows.map(([key, en, ar]) => ({ key, en, ar, parts: graphemes(ar) }))
const FULL = ROWS.map((r) => r.parts.length)

/** Rows of the real dualkit-strings.json. Once in view, each Arabic cell types itself in, row by row, and its draft chip lights. */
export function Ledger() {
  const ref = useRef<HTMLDivElement>(null)
  const { visible, reduced } = useSequence(ref)
  const [typed, setTyped] = useState<number[]>(FULL)
  const started = useRef(false)

  useLayoutEffect(() => { if (!reduced && !started.current) setTyped(FULL.map(() => 0)) }, [reduced])
  useEffect(() => {
    if (!visible || reduced || started.current) return
    started.current = true
    const ids: number[] = []
    let at = 200
    FULL.forEach((n, row) => {
      for (let c = 1; c <= n; c += 1) {
        at += CHAR_MS
        ids.push(window.setTimeout(() => setTyped((t) => t.map((v, k) => (k === row ? c : v))), at))
      }
      at += ROW_GAP_MS
    })
    return () => ids.forEach(clearTimeout)
  }, [visible, reduced])

  return (
    <div ref={ref} className="cv-ledger-paint v3-painting">
      <div className="cv-ledger v3-glass">
        <div className="cv-ledger-head">
          <span className="v3-mono">{L.file}</span>
          <span className="v3-pv-status"><i className="v3-pv-dot" aria-hidden="true" />{L.tally(PROOF_COUNTS.strings)}</span>
        </div>
        <table className="cv-ledger-table">
          <thead>
            <tr>{L.columns.map((c) => <th key={c} scope="col">{c}</th>)}<th scope="col"><span className="v3-sr">Status</span></th></tr>
          </thead>
          <tbody>
            {ROWS.map((r, k) => {
              const n = typed[k] ?? 0
              const done = n >= r.parts.length
              return (
                <tr key={r.key}>
                  <td className="v3-mono cv-ledger-key">{r.key}</td>
                  <td>{r.en}</td>
                  <td lang="ar" dir="rtl" className="cv-ledger-ar">
                    <span className="v3-sr">{r.ar}</span>
                    <span aria-hidden="true">{r.parts.slice(0, n).join('')}{n > 0 && !done ? <i className="cv-term-caret" /> : null}</span>
                  </td>
                  <td><span className="cv-chip" data-on={done || undefined}>{L.status}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
