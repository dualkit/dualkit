import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './direction'

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'dir'> & {
  label: ReactNode
  help?: ReactNode
  /** Replaces the help and marks the input invalid. */
  error?: ReactNode
}

/** Label and help follow the page; the value picks its own direction, so an email stays left to right in Arabic. */
export function Field({ label, help, error, id, className, ...input }: FieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  const noteId = `${inputId}-note`
  const note = error ?? help
  return (
    <div className={cx('dk-field', error != null && 'dk-field--error', className)}>
      <label className="dk-label" htmlFor={inputId}>{label}</label>
      <input {...input} id={inputId} dir="auto" className="dk-field__input"
        aria-invalid={error != null ? true : undefined} aria-describedby={note != null ? noteId : undefined} />
      {note != null && <p id={noteId} className={cx('dk-caption', error != null ? 'dk-danger' : 'dk-secondary')}>{note}</p>}
    </div>
  )
}
