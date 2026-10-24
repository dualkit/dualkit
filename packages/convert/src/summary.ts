import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STATE_DIR } from './state'
import type { ConvertSummary, Flag } from './types'

export const SUMMARY_FILE = `${STATE_DIR}/summary.json`

/** The saved phase 1 summary, or null when it is missing or unreadable. */
export function readSummary(root: string): ConvertSummary | null {
  const path = join(root, SUMMARY_FILE)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ConvertSummary>
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.flags) && Array.isArray(parsed.changed) && parsed.byKind ? (parsed as ConvertSummary) : null
  } catch {
    return null
  }
}

const flagKey = (f: Flag): string => `${f.file}\0${f.line}\0${f.kind}\0${f.message}`

/** The new summary with the earlier flags kept, deduped, so a re-run does not lose what the first run found. */
export function mergeSummary(earlier: ConvertSummary | null, next: ConvertSummary): ConvertSummary {
  if (!earlier) return next
  const seen = new Set<string>()
  const flags = [...next.flags, ...earlier.flags].filter((f) => !seen.has(flagKey(f)) && Boolean(seen.add(flagKey(f))))
  return { ...next, flags }
}

/** Writes the summary as 2-space JSON next to the state. */
export function saveSummary(root: string, summary: ConvertSummary): void {
  mkdirSync(join(root, STATE_DIR), { recursive: true })
  writeFileSync(join(root, SUMMARY_FILE), JSON.stringify(summary, null, 2) + '\n')
}
