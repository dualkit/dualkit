'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { BenchModel } from '@/lib/bench-schema'
import { BENCH_COPY } from '@/lib/bench-copy'
import { movementOf, trackOf, unrankedReason } from '@/lib/bench-view'
import { MakerMark } from './MakerMark'
import { ModelScreens } from './ModelScreens'

const C = BENCH_COPY
const STAGGER_MS = 60

const liftLabel = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

function Movement({ model }: { model: BenchModel }) {
  const m = movementOf(model)
  if (m.kind === 'new') return <span className="bx-move faint">{C.newModel}</span>
  if (m.kind === 'level') return <span className="bx-move faint">{C.level}</span>
  const up = m.kind === 'up'
  return (
    <span className={`bx-move${up ? '' : ' faint'}`} aria-label={`${up ? 'Up' : 'Down'} ${m.n} since last month`}>
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d={up ? 'M4 1.5L7 6H1z' : 'M4 6.5L1 2h6z'} fill="currentColor" /></svg>{m.n}
    </span>
  )
}

function ModelName({ model }: { model: BenchModel }) {
  return (
    <span className="bx-model">
      <span className="bx-tile"><MakerMark mark={model.mark} by={model.by} /></span>
      <span className="bx-names"><span className="bx-label">{model.label}</span><span className="small faint">{model.by}</span></span>
    </span>
  )
}

function Track({ alone, dualkit }: { alone: number; dualkit: number }) {
  const style = { '--a': alone.toFixed(2), '--d': dualkit.toFixed(2) } as React.CSSProperties
  return <span className="bx-track" style={style} aria-hidden="true"><i className="bx-line" /><i className="bx-ring" /><i className="bx-point" /></span>
}

function Row({ model, open, onToggle, panelId, ruleCount, fixes }: { model: BenchModel; open: boolean; onToggle: () => void; panelId: string; ruleCount: number; fixes: Record<string, string> }) {
  const t = trackOf(model)
  // Screens mount on first open and stay, so closing animates the content out instead of emptying it first.
  const ever = useRef(false)
  if (open) ever.current = true
  return (
    <>
      <button type="button" className="bx-row" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="bx-rank">
          <span className={`bx-label${model.rank === null ? ' faint' : ''}`}>{model.rank ?? C.level}</span>
          <Movement model={model} />
        </span>
        <ModelName model={model} />
        {t && model.alone && model.dualkit ? (
          <>
            <span className="bx-track-cell"><Track alone={t.alone} dualkit={t.dualkit} /></span>
            <span className="bx-pair bx-label tnum">{model.alone.rulesPassed} → {model.dualkit.rulesPassed}</span>
            <span className="bx-lift h2 tnum">{liftLabel(model.lift ?? model.dualkit.rulesPassed - model.alone.rulesPassed)}</span>
            <span className="bx-nums small"><span className="soft">{C.alone} {model.alone.rulesPassed}</span><span>{C.dualkit} {model.dualkit.rulesPassed}</span></span>
          </>
        ) : (
          <span className="bx-missing"><span className="bx-label soft">{C.didntRun}</span><span className="small faint">{unrankedReason(model)}</span></span>
        )}
      </button>
      <div className="bx-collapse" id={panelId} data-open={open} inert={!open} role="region" aria-label={`${model.label} screens`}>
        <div className="bx-collapse-inner">{ever.current && <ModelScreens model={model} ruleCount={ruleCount} fixes={fixes} />}</div>
      </div>
    </>
  )
}

/**
 * The leaderboard. On first view each track draws from 0 to its two scores, a row at a time.
 * Rows open their five screens beneath them, one model at a time.
 */
export function Board({ models, ruleCount, fixes }: { models: readonly BenchModel[]; ruleCount: number; fixes: Record<string, string> }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const base = useId()

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, k) => {
        const el = e.target as HTMLElement
        el.style.setProperty('--delay', `${k * STAGGER_MS}ms`)
        el.dataset.seen = 'true'
        io.unobserve(el)
      })
    }, { threshold: 0.5 })
    root.querySelectorAll('.bx-track').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="bx-board" ref={ref} data-anim="">
      <noscript><style>{'.bx-board[data-anim] .bx-track > i { transition: none !important; } .bx-board[data-anim] .bx-track:not([data-seen]) > .bx-ring { transform: translateX(calc(var(--a) * 1cqw)); } .bx-board[data-anim] .bx-track:not([data-seen]) > .bx-point { transform: translateX(calc(var(--d) * 1cqw)); } .bx-board[data-anim] .bx-track:not([data-seen]) > .bx-line { transform: translateX(calc(var(--a) * 1cqw)) scaleX(calc((var(--d) - var(--a)) / 100)); }'}</style></noscript>
      <div className="bx-row bx-header small faint" aria-hidden="true">
        <span>{C.columns.rank}</span>
        <span>{C.columns.model}</span>
        <span className="bx-scale">{C.scale.map((s) => <span key={s}>{s}</span>)}</span>
        <span>{C.columns.pair}</span>
        <span>{C.columns.lift}</span>
      </div>
      {models.map((m) => (
        <Row key={m.id} model={m} open={openId === m.id} panelId={`${base}-${m.id}`} ruleCount={ruleCount} fixes={fixes}
          onToggle={() => setOpenId((id) => (id === m.id ? null : m.id))} />
      ))}
    </div>
  )
}
