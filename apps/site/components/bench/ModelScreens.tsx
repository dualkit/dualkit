'use client'
import { useId, useState } from 'react'
import type { BenchCell, BenchModel } from '@/lib/bench-schema'
import { BENCH_COPY } from '@/lib/bench-copy'
import { ChevronIcon } from '@/components/icons'
import { ScreenSide } from './ScreenSide'

const C = BENCH_COPY
const result = (c: BenchCell, ruleCount: number, cond: string) => (c.ran ? `${c.rulesPassed} of ${ruleCount} ${cond}` : `Didn’t run ${cond}`)

/** One model's five screens. The first starts open; each toggles on its own. */
export function ModelScreens({ model, ruleCount, fixes }: { model: BenchModel; ruleCount: number; fixes: Record<string, string> }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(model.screens[0] ? [model.screens[0].id] : []))
  const base = useId()
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))

  return (
    <div className="bx-screens">
      {model.screens.map((s) => {
        const isOpen = open.has(s.id)
        const alone = result(s.alone, ruleCount, 'alone')
        const dualkit = result(s.dualkit, ruleCount, 'with Dualkit')
        return (
          <section className="bx-screen" key={s.id}>
            <button type="button" className="bx-screen-head" aria-expanded={isOpen} aria-controls={`${base}-${s.id}`} onClick={() => toggle(s.id)}>
              <span className="bx-screen-title">{s.title}</span>
              <span className="bx-screen-result small faint">{alone}</span>
              <span className="bx-screen-result small">{dualkit}</span>
              <span className="bx-screen-results small soft">{alone} · {dualkit}</span>
              <ChevronIcon size={12} className="bx-chev soft" />
            </button>
            <div className="bx-collapse" id={`${base}-${s.id}`} data-open={isOpen} inert={!isOpen}>
              <div className="bx-collapse-inner">
                <div className="bx-compare">
                  <ScreenSide name={C.alone} cell={s.alone} ruleCount={ruleCount} fixes={fixes} />
                  <ScreenSide name={C.dualkit} cell={s.dualkit} ruleCount={ruleCount} fixes={fixes} />
                </div>
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
