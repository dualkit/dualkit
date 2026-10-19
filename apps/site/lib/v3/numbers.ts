import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CURRENCIES } from '@dualkit/format'
import { RULES } from '@dualkit/rules'
import { V3 } from './copy'
import { TEST_COUNT } from './testcount'

const SKILLS_DIR = join(process.cwd(), '..', '..', 'plugin', 'skills')

export const skillCount = (dir = SKILLS_DIR) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).length

/** The four counters, each read from its source at build time, with the copy's labels. */
export function numbersStats(): { value: string; what: string }[] {
  const values = [TEST_COUNT.toLocaleString('en-US'), String(RULES.length), String(CURRENCIES.length), String(skillCount())]
  return V3.numbers.stats.map(([, what], i) => ({ value: values[i] ?? '', what }))
}
