import { toArabicDigits, toWesternDigits } from '@dualkit/format'
import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './direction'

export type DigitInputProps = {
  label: ReactNode
  /** The page language. Arabic shows Arabic-Indic digits; the value is always Western digits. */
  locale?: 'en' | 'ar'
  length?: number
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  help?: ReactNode
  error?: ReactNode
  className?: string
}

/** Every digit system people type, reduced to Western digits and nothing else. */
const digitsIn = (text: string) => toWesternDigits(text).replace(/\D/g, '')
const boxLabel = (locale: 'en' | 'ar', k: number, n: number) =>
  locale === 'ar' ? `الخانة ${toArabicDigits(k + 1)} من ${toArabicDigits(n)}` : `Digit ${k + 1} of ${n}`

/** A one-time code. The boxes stay left to right in both languages, because codes are read that way. */
export function DigitInput({ label, locale = 'en', length = 6, value, defaultValue = '', onChange, onComplete, help, error, className }: DigitInputProps) {
  const [own, setOwn] = useState(() => digitsIn(defaultValue).slice(0, length))
  const code = value !== undefined ? digitsIn(value).slice(0, length) : own
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  const labelId = useId()
  const noteId = useId()
  const note = error ?? help

  const focus = (k: number) => {
    const el = boxes.current[Math.max(0, Math.min(length - 1, k))]
    el?.focus()
    el?.select()
  }

  const commit = (next: string) => {
    if (next === code) return
    if (value === undefined) setOwn(next)
    onChange?.(next)
    if (next.length === length) onComplete?.(next)
  }

  /** Write digits over the boxes from k on, keep whatever comes after them, and move to the next box. */
  const writeFrom = (k: number, incoming: string) => {
    const next = (code.slice(0, k) + incoming + code.slice(k + incoming.length)).slice(0, length)
    commit(next)
    focus(k + incoming.length)
  }

  /** Take out the digit in box k and close the gap, so the code stays one unbroken string. */
  const removeAt = (k: number) => commit(code.slice(0, k) + code.slice(k + 1))

  const onInput = (k: number, raw: string) => {
    const typed = digitsIn(raw)
    if (!typed) {
      if (raw === '') removeAt(k)
      return
    }
    // A box that already held a digit sees both; keep the new one.
    const previous = code[k]
    const incoming = previous && typed.length === 2 ? (typed.startsWith(previous) ? typed.slice(1) : typed.slice(0, 1)) : typed
    writeFrom(Math.min(k, code.length), incoming)
  }

  const onKeyDown = (k: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[k] && k > 0) {
      e.preventDefault()
      removeAt(k - 1)
      focus(k - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(k - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(k + 1)
    }
  }

  const onPaste = (k: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = digitsIn(e.clipboardData.getData('text'))
    if (pasted) writeFrom(Math.min(k, code.length), pasted)
  }

  const shown = (d: string | undefined) => (d ? (locale === 'ar' ? toArabicDigits(d) : d) : '')

  return (
    <div className={cx('dk-digits', locale === 'ar' && 'dk-digits--arab', error != null && 'dk-digits--error', className)}>
      <span id={labelId} className="dk-label">{label}</span>
      <div className="dk-digits__boxes" dir="ltr" role="group" aria-labelledby={labelId} aria-describedby={note != null ? noteId : undefined}>
        {Array.from({ length }, (_, k) => (
          <input key={k} ref={(el) => { boxes.current[k] = el }} className="dk-digits__box"
            type="text" inputMode="numeric" autoComplete={k === 0 ? 'one-time-code' : 'off'}
            aria-label={boxLabel(locale, k, length)} aria-invalid={error != null ? true : undefined}
            value={shown(code[k])}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onInput(k, e.currentTarget.value)}
            onKeyDown={(e) => onKeyDown(k, e)}
            onPaste={(e) => onPaste(k, e)} />
        ))}
      </div>
      {note != null && <div id={noteId} className={cx('dk-caption', error != null ? 'dk-danger' : 'dk-secondary')}>{note}</div>}
    </div>
  )
}
