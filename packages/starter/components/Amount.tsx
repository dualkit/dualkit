import { formatMoney, type Currency } from '@dualkit/format'
import type { ReactNode } from 'react'
import { cx } from './direction'

export type AmountProps = {
  amount: number
  currency: Currency
  /** Arabic puts the abbreviation after the number and uses Arabic-Indic digits. */
  locale?: 'en' | 'ar'
  label?: ReactNode
  note?: ReactNode
  className?: string
}

/** The figure sits in a bdi, so it never trades places with the words around it. */
export function Amount({ amount, currency, locale = 'en', label, note, className }: AmountProps) {
  const figure = formatMoney(amount, { currency, locale, numerals: locale === 'ar' ? 'arab' : 'latn' })
  return (
    <div className={cx('dk-amount', className)}>
      {label != null && <span className="dk-caption dk-secondary">{label}</span>}
      <bdi className="dk-amount__figure">{figure}</bdi>
      {note != null && <span className="dk-caption dk-tertiary">{note}</span>}
    </div>
  )
}
