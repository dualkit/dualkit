// Words and numbers for the report: plurals, dates and the verdict sentence.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** 2026-10-16T12:00:00.000Z reads 16 Oct 2026; anything unparseable is shown as its first ten characters. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** The verdict in two parts: the headline, and the faint line that splits it by severity. */
export function verdict(errors: number, warnings: number): { lead: string; detail: string } {
  const total = errors + warnings
  if (total === 0) return { lead: 'No problems an Arabic reader will notice.', detail: '' }
  const parts = [
    errors > 0 ? `${errors} ${errors === 1 ? 'breaks' : 'break'} the screen` : '',
    warnings > 0 ? `${warnings} ${warnings === 1 ? 'makes' : 'make'} it feel translated` : '',
  ].filter(Boolean)
  return { lead: `${plural(total, 'problem', 'problems')} an Arabic reader will notice.`, detail: `${parts.join(', ')}.` }
}
