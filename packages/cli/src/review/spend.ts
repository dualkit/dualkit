import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Tracks what paid model calls have cost this month. `capUsd: null` means no cap. */
export type Ledger = { spent(): number; add(usd: number): void; capUsd: number | null }

type Record = { month: string; usd: number; calls: number }

const monthKey = (d: Date) => d.toISOString().slice(0, 7)

function read(path: string, month: string): Record {
  try {
    const r = JSON.parse(readFileSync(path, 'utf8'))
    if (r && r.month === month && Number.isFinite(r.usd) && Number.isFinite(r.calls)) return { month, usd: r.usd, calls: r.calls }
  } catch {
    // A missing or corrupt file starts the month at 0.
  }
  return { month, usd: 0, calls: 0 }
}

/** A ledger kept in a JSON file as `{ month, usd, calls }`. The month is UTC `YYYY-MM`, and a new month starts at 0. */
export function fileLedger(path: string, capUsd: number | null, now: () => Date = () => new Date()): Ledger {
  return {
    capUsd,
    spent: () => read(path, monthKey(now())).usd,
    add(usd) {
      const current = read(path, monthKey(now()))
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify({ month: current.month, usd: current.usd + usd, calls: current.calls + 1 }))
    },
  }
}
