'use client'
import { formatHijri, formatMoney } from '@dualkit/format'
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useVisible, wait } from '@/lib/motion'
import { ArrowIcon, BackIcon } from './icons'

// The product window plays one story on a loop: the agent loads the skills, the first render reverses
// the phone number (a real bidi bug, rendered by your browser), then the fix lands and the inspector points at it.
const PROMPT = 'Build the payment summary in Arabic'
const DUE = new Date('2026-02-18T12:00:00Z')
const AMOUNT = formatMoney(1234.5, { currency: 'AED', locale: 'ar' })
const HIJRI = formatHijri(DUE, { locale: 'ar', timeZone: 'Asia/Riyadh' })
const TERM = ['$ /plugin install dualkit@dualkit', 'installed 4 skills', '$ npm i @dualkit/format', 'added 1 package, 0 dependencies']
const LOOP_MS = 16000

type Frame = { typed: number; steps: number; broken: boolean; shown: boolean; edit: boolean; fixed: boolean; reply: boolean; term: number }
const START: Frame = { typed: 0, steps: 0, broken: false, shown: false, edit: false, fixed: false, reply: false, term: 0 }
const END: Frame = { typed: PROMPT.length, steps: 2, broken: false, shown: true, edit: true, fixed: true, reply: true, term: TERM.length }

function useStory(run: boolean) {
  const [f, setF] = useState<Frame>(END)
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (!run) return
    if (prefersReducedMotion()) { setF(END); return }
    let alive = true
    const set = (patch: Partial<Frame>) => alive && setF((x) => ({ ...x, ...patch }))
    ;(async () => {
      setF(START)
      await wait(500)
      for (let n = 1; n <= PROMPT.length && alive; n++) { set({ typed: n }); await wait(33) }
      set({ term: 1 }); await wait(600)
      set({ steps: 1, term: 2 }); await wait(600)
      set({ steps: 2 }); await wait(700)
      set({ shown: true, broken: true }); await wait(1500)
      set({ edit: true }); await wait(900)
      set({ broken: false, fixed: true }); await wait(800)
      set({ reply: true, term: 3 }); await wait(600)
      set({ term: 4 })
      await wait(LOOP_MS - 8800)
      if (alive) setCycle((c) => c + 1)
    })()
    return () => { alive = false }
  }, [run, cycle])
  return [f, () => setCycle((c) => c + 1)] as const
}

/** Drag a window by its title bar. Offsets are kept per window and reset on narrow screens by CSS. */
function useDrag() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { if (matchMedia('(max-width: 960px)').matches) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; setDragging(true) },
    onPointerMove: (e: React.PointerEvent) => { const s = start.current; if (s) setOffset({ x: s.ox + e.clientX - s.x, y: s.oy + e.clientY - s.y }) },
    onPointerUp: () => { start.current = null; setDragging(false) },
  }
  return { style: { transform: `translate(${offset.x}px, ${offset.y}px)` }, dragging, handlers }
}

const Lights = () => <span className="lights" aria-hidden="true"><i /><i /><i /></span>

export function Stage() {
  const [ref, visible] = useVisible<HTMLDivElement>()
  const [f, replay] = useStory(visible)
  const app = useDrag(), term = useDrag()
  return (
    <div className="stage rise" style={{ animationDelay: '800ms' }} ref={ref}>
      <button type="button" className="replay" onClick={replay}>Replay</button>
      <div className={`win app${app.dragging ? ' dragging' : ''}`} style={app.style}>
        <div className="titlebar" {...app.handlers}><Lights /><span className="t">Claude Code · checkout</span><span /></div>
        <div className="panes">
          <div className="chat">
            <div className="convo">
              <div className="box">{PROMPT.slice(0, f.typed)}{f.typed < PROMPT.length && <span className="caret" />}</div>
              {f.steps >= 1 && <div className="step"><span className="v">Loaded</span><code>dualkit-rtl-layout</code></div>}
              {f.steps >= 2 && <div className="step"><span className="v">Loaded</span><code>dualkit-gulf-formats</code></div>}
              {f.edit && <div className="edit"><code>PaymentSummary.tsx</code><span className="add">+38</span><span className="del">-6</span></div>}
              {f.reply && <p className="reply" style={{ margin: 0 }}>Mirrored the layout and isolated the phone number, so it stays left to right.</p>}
            </div>
            <div className="box ask">Ask Claude to build anything</div>
          </div>
          <div className="browser">
            <div className="bar"><BackIcon /><ArrowIcon /><span className="url">localhost:3000/checkout</span></div>
            <div className="canvas">
              <div className={`checkout${f.shown ? '' : ' loading'}`} dir="rtl" lang="ar">
                <span className="t">ملخص الدفع</span>
                <span className="l">المبلغ المستحق</span>
                <span className="amt"><bdi suppressHydrationWarning>{AMOUNT}</bdi></span>
                <span className="row"><span className="soft">تاريخ الاستحقاق</span><bdi suppressHydrationWarning>{HIJRI}</bdi></span>
                <span className="l">رقم الجوال للإيصال</span>
                <span className="field">
                  <span className={`inspector${f.fixed ? ' on' : ''}`} dir="ltr">bdi · phone</span>
                  {f.broken
                    ? <span className="phone broken">+971 050 123 4567</span>
                    : <span className={`phone${f.fixed ? ' inspect' : ''}`} dir="ltr"><span className="cc">+971</span><span>050 123 4567</span></span>}
                </span>
                <span className="pay">إتمام الدفع</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`win term${term.dragging ? ' dragging' : ''}`} style={term.style}>
        <div className="titlebar" {...term.handlers}><Lights /><span className="t">Terminal</span><span /></div>
        <div className="out">
          {TERM.slice(0, f.term).map((line) => <span key={line} className={line.startsWith('$') ? 'step' : 'step ok'}>{line}</span>)}
        </div>
      </div>
    </div>
  )
}
