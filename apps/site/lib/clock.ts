import { formatHijri } from '@dualkit/format'

/** The time and Hijri date in a Gulf time zone, plus where the minute sits across the day (0 to 1). */
export function gulfClock(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(at)
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return { time: `${hh}:${mm}`, hijri: formatHijri(at, { timeZone }), dayFraction: (Number(hh) * 60 + Number(mm)) / 1440 }
}
