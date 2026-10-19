'use client'
import { useState } from 'react'
import type { BenchCell } from '@/lib/bench-schema'
import { BENCH_COPY } from '@/lib/bench-copy'
import { CheckIcon } from '@/components/icons'
import { SHOT_W, cellReason, pinSide, rawUrl, shotMarks, sideLine, type ShotMarks } from '@/lib/bench-view'

const C = BENCH_COPY
/** Both builds show the same top 300 css px of the phone, so the comparison stays fair. */
const CROP_H = 300

const Pin = ({ n }: { n: number }) => <span className="bx-pin">{n}</span>
/** A length in the shot's own css px, scaled to the side's width (the shot box is a size container). */
const px = (n: number) => `calc(${n} * 100cqw / ${SHOT_W})`

function Shot({ src, height, marks }: { src: string; height: number; marks: ShotMarks }) {
  const [whole, setWhole] = useState(false)
  const tall = height > CROP_H
  const h = whole || !tall ? height : CROP_H
  return (
    <div className="bx-shot-wrap">
      <div className="bx-shot" style={{ height: px(h) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={SHOT_W} height={height} alt="" loading="lazy" decoding="async" />
        {marks.rings.map((r) => {
          const side = pinSide(r.box, r.numbers.length)
          const top = `calc(${r.box.y + r.box.height / 2} * 100cqw / ${SHOT_W} - 9px)`
          const pins = side === 'end'
            ? { left: `calc(${r.box.x + r.box.width} * 100cqw / ${SHOT_W} + 12px)`, top }
            : { right: `calc(100cqw - ${r.box.x} * 100cqw / ${SHOT_W} + 12px)`, top }
          return (
            <span key={`${r.box.x},${r.box.y},${r.numbers.join('-')}`}>
              <span className="bx-ring-box" style={{ left: `calc(${px(r.box.x)} - 4px)`, top: `calc(${px(r.box.y)} - 4px)`, width: `calc(${px(r.box.width)} + 8px)`, height: `calc(${px(r.box.height)} + 8px)` }} />
              <span className="bx-pins" style={pins}>{r.numbers.map((n) => <Pin key={n} n={n} />)}</span>
            </span>
          )
        })}
        {marks.corner.length > 0 && <span className="bx-pins bx-corner">{marks.corner.map((n) => <Pin key={n} n={n} />)}</span>}
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
  if (!cell.ran) {
    return (
      <div className="bx-side">
        <div className="bx-side-head"><span className="bx-label">{name}</span></div>
        <div className="bx-side-body"><span className="bx-label soft">{C.didntRun}</span><span className="small faint">{cellReason(cell)}</span></div>
      </div>
    )
  }
  const marks = shotMarks(cell.findings)
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
