'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BenchCell } from '@/lib/bench-schema'
import { BENCH_COPY } from '@/lib/bench-copy'
import { CheckIcon } from '@/components/icons'
import { RING_PAD, SHOT_W, cellReason, placePins, rawUrl, shotMarks, sideLine, type PinSpot, type ShotMarks } from '@/lib/bench-view'

const C = BENCH_COPY
/** Both builds show the same top 300 css px of the phone, so the comparison stays fair. */
const CROP_H = 300

const Pin = ({ n }: { n: number }) => <span className="bx-pin">{n}</span>
/** A length in the shot's own css px, scaled to the side's width (the shot box is a size container). */
const px = (n: number) => `calc(${n} * 100cqw / ${SHOT_W})`

/** The shot's rendered width, so pins (fixed 18px) can be placed against rings that scale with it. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => { if (e) setWidth(e.contentRect.width) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const spotStyle = (s: PinSpot) => ({ left: s.left, top: s.top })

function Shot({ src, height, marks }: { src: string; height: number; marks: ShotMarks }) {
  const [whole, setWhole] = useState(false)
  const [ref, width] = useWidth<HTMLDivElement>()
  const spots = useMemo(() => (width ? placePins(marks.rings, marks.corner, width) : null), [marks, width])
  const tall = height > CROP_H
  const h = whole || !tall ? height : CROP_H
  return (
    <div className="bx-shot-wrap">
      <div className="bx-shot" ref={ref} style={{ height: px(h) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={SHOT_W} height={height} alt="" loading="lazy" decoding="async" />
        {marks.rings.map((r) => (
          <span key={`ring-${r.box.x},${r.box.y}`} className="bx-ring-box" style={{ left: `calc(${px(r.box.x)} - ${RING_PAD}px)`, top: `calc(${px(r.box.y)} - ${RING_PAD}px)`, width: `calc(${px(r.box.width)} + ${RING_PAD * 2}px)`, height: `calc(${px(r.box.height)} + ${RING_PAD * 2}px)` }} />
        ))}
        {spots?.rings.map((s, i) => (
          <span key={`pins-${i}`} className="bx-pins" style={spotStyle(s)}>{marks.rings[i]!.numbers.map((n) => <Pin key={n} n={n} />)}</span>
        ))}
        {spots?.corner && <span className="bx-pins" style={spotStyle(spots.corner)}>{marks.corner.map((n) => <Pin key={n} n={n} />)}</span>}
      </div>
      {tall && (
        <button type="button" className="bx-text-btn small soft" aria-expanded={whole} onClick={() => setWhole((w) => !w)}>
          {whole ? C.showLess : C.showWhole}
        </button>
      )}
    </div>
  )
}

/** One side of a screen: its score, the median build's screenshot with rings, and the fixes. */
export function ScreenSide({ name, cell, ruleCount, fixes }: { name: string; cell: BenchCell; ruleCount: number; fixes: Record<string, string> }) {
  const marks = useMemo(() => shotMarks(cell.ran ? cell.findings : []), [cell])
  if (!cell.ran) {
    return (
      <div className="bx-side">
        <div className="bx-side-head"><span className="bx-label">{name}</span></div>
        <div className="bx-side-body"><span className="bx-label soft">{C.didntRun}</span><span className="small faint">{cellReason(cell)}</span></div>
      </div>
    )
  }
  return (
    <div className="bx-side">
      <div className="bx-side-head"><span className="bx-label">{name}</span><span className="small faint tnum">{sideLine(cell, ruleCount)}</span></div>
      <div className="bx-side-body">
        {cell.shot ? <Shot src={cell.shot} height={Math.max(cell.pageHeight, 1)} marks={marks} /> : <div className="bx-noshot small faint">{C.noShot}</div>}
        {cell.missing.length > 0 && <p className="bx-left-out small soft">{C.leftOut} {cell.missing.join(', ')}</p>}
        {marks.items.length > 0 ? (
          <ol className="bx-findings">
            {marks.items.map((i) => (
              <li key={i.rule}>
                <Pin n={i.n} />
                <span className="bx-finding-text">
                  <span className="bx-label">{i.title}</span>
                  <span className="small soft">{i.wholePage ? `${C.wholePage} ` : ''}{fixes[i.rule] ?? ''}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="bx-pass bx-label"><CheckIcon />{C.passes(ruleCount)}</p>
        )}
        <a className="bx-raw small soft" href={rawUrl(cell.raw)}>{C.openRaw}</a>
      </div>
    </div>
  )
}
