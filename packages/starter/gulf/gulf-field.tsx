import { toArabicDigits, type Numerals, type Result } from '@dualkit/format'
import {
  useId, useLayoutEffect, useRef, useState,
  type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import { Label } from '@/components/ui/label'

/** Props every gulf field shares. All copy comes in from the app, so each language owns its own words. */
export type GulfFieldText<C extends string> = {
  label: ReactNode
  help?: ReactNode
  /** Shown at once and marks the field invalid. Use it for errors the app finds, such as a required field. */
  error?: ReactNode
  /** Copy for each format error code, shown once the field loses focus. A code with no copy shows format's English message. */
  errorMessages?: Partial<Record<C, ReactNode>>
  id?: string
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export type FieldAria = {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

export const cx = (...parts: ReadonlyArray<string | false | null | undefined>): string => parts.filter(Boolean).join(' ')

/** Arabic-Indic digits on screen when asked; the value underneath stays Western. */
export const withNumerals = (text: string, numerals: Numerals): string => (numerals === 'arab' ? toArabicDigits(text) : text)

type GulfFieldProps = {
  id: string | undefined
  label: ReactNode
  help: ReactNode
  error: ReactNode
  className: string | undefined
  children: (aria: FieldAria) => ReactNode
}

/** Label, control and one note under it. The label and note follow the page direction; each control sets its own. */
export function GulfField({ id, label, help, error, className, children }: GulfFieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  const noteId = `${inputId}-note`
  const note = error ?? help
  return (
    <div data-slot="gulf-field" className={cx('grid gap-2', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {children({
        id: inputId,
        'aria-invalid': error != null ? true : undefined,
        'aria-describedby': note != null ? noteId : undefined,
      })}
      {note != null && (
        <p id={noteId} role={error != null ? 'alert' : undefined}
          className={cx('text-sm', error != null ? 'text-destructive' : 'text-muted-foreground')}>{note}</p>
      )}
    </div>
  )
}

/** The error to show: the app's own at once, format's only after the person leaves the field, and never for an empty one. */
export function useShownError<C extends string>(
  result: Result<unknown, C>,
  error: ReactNode,
  messages: Partial<Record<C, ReactNode>> | undefined,
): { error: ReactNode; onBlur: () => void } {
  const [touched, setTouched] = useState(false)
  const fromFormat = touched && !result.ok && result.error.code !== 'empty'
    ? (messages?.[result.error.code] ?? result.error.message)
    : undefined
  return { error: error ?? fromFormat, onBlur: () => setTouched(true) }
}

export type Mask = {
  /** Raw text from the field to the stored value. */
  normalize: (raw: string) => string
  /** Stored value to the text on screen. Each stored character shows as one character, plus separators. */
  display: (value: string) => string
  /** Characters the display adds, which the caret steps over. */
  separator?: RegExp
}

const countValue = (text: string, separator: RegExp | undefined): number =>
  separator ? [...text].filter((ch) => !separator.test(ch)).length : text.length

/** The first index in the shown text with n stored characters before it. */
function positionAfter(text: string, n: number, separator: RegExp | undefined): number {
  if (!separator) return Math.min(n, text.length)
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (seen === n) return i
    if (!separator.test(text[i] ?? '')) seen++
  }
  return text.length
}

/**
 * Phones, IBANs, IDs, amounts and dates read left to right in every language. Arabic-Indic digits are Arabic numbers
 * to the bidi algorithm, so a space or hyphen between two groups would flip their order; overriding keeps typed order.
 */
export const LTR_VALUE: CSSProperties = { unicodeBidi: 'bidi-override' }
/** The override is inherited by ::placeholder and would reverse an Arabic placeholder, so the placeholder opts out. */
export const LTR_PLACEHOLDER = 'placeholder:[unicode-bidi:normal]'

type MaskedInput = {
  ref: RefObject<HTMLInputElement | null>
  style: CSSProperties
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** A controlled input whose screen text differs from its value, with the caret kept where the person put it. */
export function useMaskedInput(value: string, mask: Mask, commit: (next: string) => void): MaskedInput {
  const ref = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)
  const { normalize, display, separator } = mask

  const place = (el: HTMLInputElement, n: number) => {
    if (el.ownerDocument.activeElement !== el) return
    const at = positionAfter(el.value, n, separator)
    el.setSelectionRange(at, at)
  }

  useLayoutEffect(() => {
    const el = ref.current
    const n = caret.current
    caret.current = null
    if (n !== null && el) place(el, n)
  })

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const el = event.currentTarget
    const raw = el.value
    const n = normalize(raw.slice(0, el.selectionStart ?? raw.length)).length
    const next = normalize(raw)
    if (next === value) {
      // Nothing to store, so React skips the render and puts the old text back once this handler returns,
      // which sends the caret to the end. Put it back after that.
      caret.current = null
      queueMicrotask(() => place(el, n))
      return
    }
    caret.current = n
    commit(next)
  }

  /** Backspace or Delete next to a separator removes the character beyond it, or the key would do nothing. */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const el = event.currentTarget
    const at = el.selectionStart
    if (!separator || at === null || at !== el.selectionEnd) return
    const before = countValue(el.value.slice(0, at), separator)
    if (event.key === 'Backspace' && at > 0 && separator.test(el.value[at - 1] ?? '')) {
      event.preventDefault()
      if (before === 0) return
      caret.current = before - 1
      commit(value.slice(0, before - 1) + value.slice(before))
    } else if (event.key === 'Delete' && separator.test(el.value[at] ?? '')) {
      event.preventDefault()
      caret.current = before
      commit(value.slice(0, before) + value.slice(before + 1))
    }
  }

  return { ref, style: LTR_VALUE, value: display(value), onChange, onKeyDown }
}
