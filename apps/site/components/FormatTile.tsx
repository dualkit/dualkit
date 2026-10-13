'use client'
import { useEffect, useRef, useState } from 'react'
import { gulfClock } from '@/lib/clock'
import { readCode } from '@/lib/otp'
import { CheckIcon } from './icons'

const ZONES = [['Riyadh', 'Asia/Riyadh'], ['Dubai', 'Asia/Dubai']] as const
const DIGITS = '0123456789'

/** One digit that rolls to its new value (220ms with a slight overshoot). */
function RollDigit({ d }: { d: string }) {
  const n = DIGITS.indexOf(d)
  return (
    <span className="odo-d" aria-hidden="true">
      <span style={{ transform: `translateY(-${Math.max(n, 0)}em)` }}>{[...DIGITS].map((x) => <span key={x}>{x}</span>)}</span>
    </span>
  )
}

function Code() {
  const [cells, setCells] = useState(['٤', '٧', '٢', '٩'])
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const read = readCode(cells)
  const set = (k: number, v: string) => {
    const next = cells.map((c, i) => (i === k ? v.slice(-1) : c))
    setCells(next)
    if (v && k < 3) inputs.current[k + 1]?.focus()
  }
  return (
    <div>
      <span className="small soft">Verification code. Type it in Arabic or Western digits.</span>
      <div className={`otp${read.complete ? ' done' : ''}`} key={read.complete ? read.value : 'open'}>
        {cells.map((c, k) => (
          <input key={k} ref={(el) => { inputs.current[k] = el }} value={c} inputMode="numeric" lang="ar" aria-label={`Digit ${k + 1}`}
            onFocus={(e) => e.currentTarget.select()} onChange={(e) => set(k, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !cells[k] && k > 0) inputs.current[k - 1]?.focus() }} />
        ))}
      </div>
      <span className="read" aria-live="polite">
        {read.complete
          ? <>Read as <code>{read.value}</code><CheckIcon className="ok" size={14} /></>
          : <>Reading <code>{read.value.replace(/ /g, '·')}</code></>}
      </span>
    </div>
  )
}

function Clock() {
  const [zone, setZone] = useState<(typeof ZONES)[number][1]>('Asia/Riyadh')
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const c = now ? gulfClock(now, zone) : null
  const time = c?.time ?? '00:00'
  return (
    <div>
      <div className="clock" aria-label={c ? `${c.time} in ${zone}` : 'Loading the time'}>
        <RollDigit d={time[0]!} /><RollDigit d={time[1]!} /><span className="colon">:</span><RollDigit d={time[3]!} /><RollDigit d={time[4]!} />
      </div>
      <span className="small soft">{c ? c.hijri : ' '}</span>
      <div className="ruler" aria-hidden="true">
        {Array.from({ length: 31 }, (_, k) => <i key={k} />)}
        {c && <span className="now" style={{ left: `${c.dayFraction * 100}%` }} />}
      </div>
      <div className="zones" role="group" aria-label="Time zone">
        {ZONES.map(([label, id]) => <button key={id} type="button" aria-pressed={zone === id} onClick={() => setZone(id)}>{label}</button>)}
      </div>
    </div>
  )
}

export function FormatTile() {
  return <div className="tile format-tile"><Code /><Clock /></div>
}
