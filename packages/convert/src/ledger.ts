import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** One user-facing string, its Arabic, and how far its review has come. */
export type LedgerEntry = { key: string; en: string; ar: string; status: 'pending' | 'drafted' | 'reviewed'; file: string; line: number }

export const LEDGER_FILE = 'dualkit-strings.json'
const STATUSES = new Set(['pending', 'drafted', 'reviewed'])

function isEntry(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return ['key', 'en', 'ar', 'file'].every((k) => typeof e[k] === 'string')
    && typeof e.line === 'number' && STATUSES.has(e.status as string)
}

const byKey = (a: LedgerEntry, b: LedgerEntry): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)

/** Reads the ledger at the app root, or an empty list when there is none. Throws when it is malformed. */
export function readLedger(root: string): LedgerEntry[] {
  const path = join(root, LEDGER_FILE)
  if (!existsSync(path)) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${LEDGER_FILE} is not valid JSON: ${(error as Error).message}`)
  }
  if (!Array.isArray(parsed)) throw new Error(`${LEDGER_FILE} should hold a list of strings.`)
  const bad = parsed.findIndex((e) => !isEntry(e))
  if (bad !== -1) throw new Error(`${LEDGER_FILE} entry ${bad + 1} is missing a key, en, ar, status, file or line.`)
  return parsed as LedgerEntry[]
}

/** Writes the ledger sorted by key, as 2-space JSON with a trailing newline. */
export function writeLedger(root: string, entries: LedgerEntry[]): void {
  const sorted = [...entries].sort(byKey)
  writeFileSync(join(root, LEDGER_FILE), JSON.stringify(sorted, null, 2) + '\n')
}

/** Adds entries whose keys are new. An existing entry is kept as it is, so its `ar` and `status` survive a re-run. */
export function mergeLedger(existing: LedgerEntry[], added: LedgerEntry[]): LedgerEntry[] {
  const keys = new Set(existing.map((e) => e.key))
  const fresh = added.filter((e) => !keys.has(e.key) && keys.add(e.key))
  return [...existing, ...fresh].sort(byKey)
}

const textFor = (entry: LedgerEntry, locale: 'en' | 'ar'): string =>
  locale === 'en' || entry.status === 'pending' || entry.ar === '' ? entry.en : entry.ar

/** The messages object for one locale, nested by dotted key. A pending Arabic entry uses its English so the app still runs. */
export function messagesFor(entries: LedgerEntry[], locale: 'en' | 'ar'): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const entry of [...entries].sort(byKey)) {
    const parts = entry.key.split('.')
    let node = root
    for (const part of parts.slice(0, -1)) {
      const next = node[part] ?? {}
      if (typeof next !== 'object') throw new Error(`Key ${entry.key} sits under a key that is already a message.`)
      node[part] = next
      node = next as Record<string, unknown>
    }
    const leaf = parts[parts.length - 1]!
    if (leaf in node) throw new Error(`Key ${entry.key} is used twice or is also a group.`)
    node[leaf] = textFor(entry, locale)
  }
  return root
}
