export type GulfRegion = 'AE' | 'AE-SH' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'
/** ISO weekday: 1 is Monday, 7 is Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type GulfWeek = { readonly weekend: readonly Weekday[]; readonly firstWorkday: Weekday }

/** Each entry is frozen and separate, so no caller can change what another region reads. */
const week = (weekend: readonly Weekday[], firstWorkday: Weekday): GulfWeek =>
  Object.freeze({ weekend: Object.freeze([...weekend]), firstWorkday })

const WEEKS: Record<GulfRegion, GulfWeek> = {
  AE: week([6, 7], 1),
  'AE-SH': week([5, 6, 7], 1),
  SA: week([5, 6], 7),
  QA: week([5, 6], 7),
  KW: week([5, 6], 7),
  BH: week([5, 6], 7),
  OM: week([5, 6], 7),
}

const ISO_WEEKDAY: Record<string, Weekday> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** The weekend days and the first workday of a GCC region, as ISO weekdays. CLDR starts Gulf weeks on Saturday; the work week starts on Sunday. */
export const gulfWeek = (region: GulfRegion): GulfWeek => WEEKS[region]

/**
 * Whether a moment falls on a weekend day in the given time zone. The UAE's Friday is a half day for
 * government and private employers set their own week, so treat this as the official calendar only.
 */
export function isGulfWeekend(date: Date, region: GulfRegion, options: { readonly timeZone: string }): boolean {
  if (Number.isNaN(date.getTime())) throw new RangeError('isGulfWeekend needs a valid date')
  if (typeof options?.timeZone !== 'string' || options.timeZone === '') {
    throw new RangeError('isGulfWeekend needs a timeZone, such as "Asia/Dubai"')
  }
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: options.timeZone }).format(date)
  const weekday = ISO_WEEKDAY[name]
  if (weekday === undefined) throw new Error(`Could not read the weekday from "${name}"`)
  return WEEKS[region].weekend.includes(weekday)
}
