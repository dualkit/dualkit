import { formatHijri, toArabicDigits } from '@dualkit/format'
import type { ReactNode } from 'react'
import { cx } from './direction'
import { Icon } from './icons'

export type DateDisplayProps = {
  date: Date
  locale?: 'en' | 'ar'
  /** Which calendar leads. The other sits underneath. */
  calendar?: 'gregorian' | 'hijri'
  /** Gulf Standard Time by default, so the day never shifts with the visitor's clock. */
  timeZone?: string
  label?: ReactNode
  zone?: ReactNode
  className?: string
}

// Names are written out, so every browser prints the same words whatever locale data it ships.
const WEEKDAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
}
const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
}

/** Year, month and day as the clock reads in that time zone. en-US is used only for its digits, which every Intl build has. */
function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const year = get('year'), month = get('month'), day = get('day')
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
}

export function formatGregorian(date: Date, locale: 'en' | 'ar', timeZone: string) {
  const { year, month, day, weekday } = partsIn(date, timeZone)
  if (locale === 'en') return `${WEEKDAYS.en[weekday]}, ${day} ${MONTHS.en[month - 1]} ${year}`
  return `${WEEKDAYS.ar[weekday]}، ${toArabicDigits(day)} ${MONTHS.ar[month - 1]} ${toArabicDigits(year)}`
}

const iso = (date: Date, timeZone: string) => {
  const { year, month, day } = partsIn(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Gregorian and Umm al-Qura Hijri together, each isolated so neither reorders the other. */
export function DateDisplay({ date, locale = 'en', calendar = 'gregorian', timeZone = 'Asia/Dubai', label, zone, className }: DateDisplayProps) {
  if (Number.isNaN(date.getTime())) throw new RangeError('DateDisplay needs a valid date')
  const gregorian = formatGregorian(date, locale, timeZone)
  const hijri = formatHijri(date, { locale, numerals: locale === 'ar' ? 'arab' : 'latn', timeZone })
  const [first, second] = calendar === 'hijri' ? [hijri, gregorian] : [gregorian, hijri]
  return (
    <div className={cx('dk-date', className)}>
      {label != null && <span className="dk-label">{label}</span>}
      <time className="dk-date__box" dateTime={iso(date, timeZone)}>
        <span className="dk-secondary"><Icon name="calendar" /></span>
        <span className="dk-date__lines">
          <bdi className="dk-date__line dk-body">{first}</bdi>
          <bdi className="dk-date__line dk-caption dk-secondary">{second}</bdi>
        </span>
      </time>
      {zone != null && <span className="dk-caption dk-tertiary">{zone}</span>}
    </div>
  )
}
