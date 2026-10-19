export type GulfRegion = 'AE' | 'AE-SH' | 'SA' | 'QA' | 'KW' | 'BH' | 'OM'
/** ISO weekday: 1 is Monday, 7 is Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type GulfWeek = { readonly weekend: readonly Weekday[]; readonly firstWorkday: Weekday }

const FRIDAY_SATURDAY: GulfWeek = { weekend: [5, 6], firstWorkday: 7 }

const WEEKS: Record<GulfRegion, GulfWeek> = {
  AE: { weekend: [6, 7], firstWorkday: 1 },
  'AE-SH': { weekend: [5, 6, 7], firstWorkday: 1 },
  SA: FRIDAY_SATURDAY,
  QA: FRIDAY_SATURDAY,
  KW: FRIDAY_SATURDAY,
  BH: FRIDAY_SATURDAY,
  OM: FRIDAY_SATURDAY,
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
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: options.timeZone }).format(date)
  const weekday = ISO_WEEKDAY[name]
  if (weekday === undefined) throw new Error(`Could not read the weekday from "${name}"`)
  return WEEKS[region].weekend.includes(weekday)
}
