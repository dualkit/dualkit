'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { APPLY_LIMITS, CV_ACCEPT, fieldError, type Field } from '@/lib/apply'
import { CAREERS } from '@/lib/careers'

const F = CAREERS.form
type InputField = Exclude<Field, 'role'>
type Errors = Partial<Record<InputField, string>>
type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; name: string; email: string } | { kind: 'failed'; message: string }

const ORDER: readonly InputField[] = ['name', 'email', 'cv', 'link', 'note']
const SHAKE_MS = 2 * 80 + 2 * 60

/** Reads a duration token like --text-swap-dur from :root, in ms. */
function token(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

/** Text that swaps in place: the old words leave upward with a blur, the new ones rise in (transitions.dev text swap). */
function SwapText({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const [phase, setPhase] = useState<'rest' | 'exit' | 'enter'>('rest')
  useEffect(() => {
    if (text === shown) return
    setPhase('exit')
    const t = setTimeout(() => {
      setShown(text)
      setPhase('enter')
      // Two frames: one to paint the below-and-blurred start, one to transition back to rest.
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('rest')))
    }, token('--text-swap-dur', 150))
    return () => clearTimeout(t)
  }, [text, shown])
  const cls = phase === 'exit' ? ' is-exit' : phase === 'enter' ? ' is-enter-start' : ''
  return <span className={`t-text-swap${cls}`}>{shown}</span>
}

/** Replays the error shake on a field's bordered box (transitions.dev error state shake). */
function shake(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove('is-shaking')
  void el.offsetWidth
  el.classList.add('is-shaking')
  setTimeout(() => el.classList.remove('is-shaking'), SHAKE_MS + 20)
}

async function send(form: HTMLFormElement): Promise<{ ok: true } | { ok: false; field: InputField | null; message: string }> {
  try {
    const res = await fetch('/api/apply', { method: 'POST', body: new FormData(form) })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; field?: string | null; error?: string }
    if (res.ok && json.ok) return { ok: true }
    const field = ORDER.includes(json.field as InputField) ? (json.field as InputField) : null
    return { ok: false, field, message: json.error ?? F.failed }
  } catch {
    return { ok: false, field: null, message: F.failed }
  }
}

function SentPanel({ name, email }: { name: string; email: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [state, setState] = useState<'out' | 'in'>('out')
  useEffect(() => {
    heading.current?.focus()
    setState('in')
  }, [])
  return (
    <div className="cr-sent" role="status">
      <span className="t-success-check cr-sent-check" data-state={state} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <path d="M14 25l7 7 13-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 ref={heading} tabIndex={-1} className="v3-step cr-sent-title">{F.sentHeading}</h2>
      <p className="v3-body cr-sent-body">{F.sent(name, email)}</p>
      <Link className="v3-btn v3-btn--outline" href="/careers">{F.sentBack}</Link>
    </div>
  )
}

/** Name, email, CV, and two optional fields. Checks on submit with the server's own rules, then posts multipart to /api/apply. */
export function ApplyForm({ role, linkHint }: { role: string; linkHint: string }) {
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const boxes = useRef<Partial<Record<InputField, HTMLElement | null>>>({})

  const box = (field: InputField) => (el: HTMLElement | null) => { boxes.current[field] = el }
  const clear = (field: InputField) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))

  function flag(next: Errors) {
    setErrors(next)
    const first = ORDER.find((f) => next[f])
    if (!first) return
    for (const f of ORDER) if (next[f]) shake(boxes.current[f] ?? null)
    boxes.current[first]?.querySelector<HTMLElement>('input, textarea')?.focus()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === 'sending') return
    const data = new FormData(e.currentTarget)
    const cv = data.get('cv')
    const values: Record<InputField, unknown> = {
      name: data.get('name'), email: data.get('email'), link: data.get('link'), note: data.get('note'),
      cv: cv instanceof File && cv.size > 0 ? { name: cv.name, size: cv.size } : null,
    }
    const next: Errors = {}
    for (const f of ORDER) { const err = fieldError(f, values[f]); if (err) next[f] = err }
    if (Object.keys(next).length) { flag(next); return }

    setStatus({ kind: 'sending' })
    const result = await send(e.currentTarget)
    if (result.ok) {
      setStatus({ kind: 'sent', name: String(values.name).trim().split(/\s+/)[0] ?? '', email: String(values.email).trim() })
      return
    }
    if (result.field) { setStatus({ kind: 'idle' }); flag({ [result.field]: result.message }); return }
    setStatus({ kind: 'failed', message: result.message })
  }

  if (status.kind === 'sent') return <SentPanel name={status.name} email={status.email} />

  const err = (f: InputField) => errors[f]
  const describe = (f: InputField, hint?: string) => [hint, err(f) ? `cr-${f}-err` : null].filter(Boolean).join(' ') || undefined
  const message = (f: InputField) => <p id={`cr-${f}-err`} className="cr-error-msg" data-shown={err(f) ? '' : undefined}>{err(f) ?? ''}</p>

  return (
    <form className="cr-form" onSubmit={onSubmit} noValidate aria-busy={status.kind === 'sending'}>
      <input type="hidden" name="role" value={role} />
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="cr-hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <div className="cr-row">
        <div className="cr-field">
          <label className="cr-label" htmlFor="cr-name">{F.name}</label>
          <div className="t-input cr-box" ref={box('name')} data-error={err('name') ? '' : undefined}>
            <input id="cr-name" name="name" className="cr-input" autoComplete="name" required maxLength={APPLY_LIMITS.name} aria-invalid={Boolean(err('name'))} aria-describedby={describe('name')} onInput={() => clear('name')} />
          </div>
          {message('name')}
        </div>
        <div className="cr-field">
          <label className="cr-label" htmlFor="cr-email">{F.email}</label>
          <div className="t-input cr-box" ref={box('email')} data-error={err('email') ? '' : undefined}>
            <input id="cr-email" name="email" type="email" className="cr-input" autoComplete="email" inputMode="email" required maxLength={APPLY_LIMITS.email} aria-invalid={Boolean(err('email'))} aria-describedby={describe('email')} onInput={() => clear('email')} />
          </div>
          {message('email')}
        </div>
      </div>

      <div className="cr-field">
        <span className="cr-label" id="cr-cv-label">{F.cv}</span>
        <div className="t-input cr-drop" ref={box('cv')} data-error={err('cv') ? '' : undefined} data-drag={dragging ? '' : undefined} data-filled={file ? '' : undefined}>
          <input
            id="cr-cv" name="cv" type="file" accept={CV_ACCEPT} required className="cr-drop-input"
            aria-labelledby="cr-cv-label cr-cv-state" aria-invalid={Boolean(err('cv'))} aria-describedby={describe('cv', 'cr-cv-hint')}
            onChange={(e) => { setFile(e.currentTarget.files?.[0] ?? null); clear('cv') }}
            onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDrop={() => setDragging(false)}
          />
          <svg className="cr-drop-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v4h16v-4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="cr-drop-text">
            <span id="cr-cv-state" className="cr-drop-name"><SwapText text={file ? file.name : F.cvEmpty} /></span>
            <span id="cr-cv-hint" className="v3-small cr-drop-hint">{file ? `${kb(file.size)} · ${F.cvChange}` : F.cvHint}</span>
          </span>
        </div>
        {message('cv')}
      </div>

      <div className="cr-field">
        <label className="cr-label" htmlFor="cr-link">{F.link} <span className="cr-opt">{F.optional}</span></label>
        <div className="t-input cr-box" ref={box('link')} data-error={err('link') ? '' : undefined}>
          <input id="cr-link" name="link" type="url" className="cr-input" inputMode="url" placeholder="https://" maxLength={APPLY_LIMITS.link} aria-invalid={Boolean(err('link'))} aria-describedby={describe('link', 'cr-link-hint')} onInput={() => clear('link')} />
        </div>
        <p id="cr-link-hint" className="v3-small cr-hint">{linkHint}</p>
        {message('link')}
      </div>

      <div className="cr-field">
        <label className="cr-label" htmlFor="cr-note">{F.note} <span className="cr-opt">{F.optional}</span></label>
        <div className="t-input cr-box" ref={box('note')} data-error={err('note') ? '' : undefined}>
          <textarea id="cr-note" name="note" className="cr-input cr-textarea" rows={4} maxLength={APPLY_LIMITS.note} aria-invalid={Boolean(err('note'))} aria-describedby={describe('note')} onInput={() => clear('note')} />
        </div>
        {message('note')}
      </div>

      <div className="cr-submit">
        <button type="submit" className="v3-btn v3-btn--ink cr-send" disabled={status.kind === 'sending'}>
          <SwapText text={status.kind === 'sending' ? F.sending : F.send} />
        </button>
        <p className="cr-error-msg cr-failed" role="alert" data-shown={status.kind === 'failed' ? '' : undefined}>{status.kind === 'failed' ? status.message : ''}</p>
      </div>
    </form>
  )
}
