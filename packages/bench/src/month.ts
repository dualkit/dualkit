import { BenchError } from './config'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
export const FAKE_MONTH = '2099-01'

/** Fake runs write into the real site tree, so they live only in 2099 months, which are git-ignored. */
export function resolveMonth({ month, fake = false, now = new Date() }: { month?: string | undefined; fake?: boolean | undefined; now?: Date }): string {
  const resolved = month || (fake ? FAKE_MONTH : now.toISOString().slice(0, 7))
  if (!MONTH.test(resolved)) throw new BenchError(`--month must be YYYY-MM, not "${resolved}".`)
  if (fake && !resolved.startsWith('2099-')) throw new BenchError(`--fake only runs in 2099 months (for example ${FAKE_MONTH}), so it cannot overwrite a real month. Got "${resolved}".`)
  return resolved
}
