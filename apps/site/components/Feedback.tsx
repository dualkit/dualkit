'use client'
import { useEffect, useRef, useState } from 'react'
import { COPY } from '../lib/copy'
import { CheckIcon, FeedbackIcon } from './icons'

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

async function submit(form: HTMLFormElement): Promise<State> {
  const data = new FormData(form)
  const body = { message: data.get('message'), email: data.get('email'), website: data.get('website'), page: location.pathname }
  try {
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    return res.ok && json.ok ? { kind: 'sent' } : { kind: 'error', message: json.error ?? COPY.feedback.failed }
  } catch {
    return { kind: 'error', message: COPY.feedback.failed }
  }
}

/** A round icon button pinned to the reading-end corner; it opens a small panel that mails Sam. */
export function Feedback() {
  const f = COPY.feedback
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    field.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  const toggle = () => { setOpen((o) => !o); if (state.kind === 'sent' || state.kind === 'error') setState({ kind: 'idle' }) }
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (state.kind === 'sending') return
    const form = e.currentTarget
    setState({ kind: 'sending' })
    const next = await submit(form)
    setState(next)
    if (next.kind === 'sent') form.reset()
  }

  return (
    <div className="fb" ref={root}>
      <div className="fb-panel" id="feedback-panel" role="dialog" aria-label={f.heading} data-open={open} inert={!open}>
        {state.kind === 'sent' ? (
          <p className="fb-sent swap-in"><CheckIcon /> {f.sent}</p>
        ) : (
          <form onSubmit={onSubmit} className="fb-form">
            <p className="fb-title">{f.heading}</p>
            <p className="small soft fb-lede">{f.lede}</p>
            <textarea ref={field} name="message" required maxLength={4000} rows={4} placeholder={f.message} aria-label={f.message} dir="auto" />
            <input name="website" tabIndex={-1} autoComplete="off" className="fb-trap" aria-hidden="true" />
            <div className="fb-end">
              <input name="email" type="email" maxLength={254} placeholder={f.email} aria-label={f.email} dir="auto" />
              <button type="submit" className="pill primary" disabled={state.kind === 'sending'}>{state.kind === 'sending' ? f.sending : f.send}</button>
            </div>
            {state.kind === 'error' && <p className="small fb-error" role="alert">{state.message}</p>}
          </form>
        )}
      </div>
      <button ref={trigger} type="button" className="fb-trigger" aria-label={f.open} aria-expanded={open} aria-controls="feedback-panel" onClick={toggle}>
        <FeedbackIcon size={18} />
      </button>
    </div>
  )
}
