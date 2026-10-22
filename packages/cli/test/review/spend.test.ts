import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileLedger } from '../../src/review/spend'

const dir = () => mkdtempSync(join(tmpdir(), 'dualkit-spend-'))

describe('fileLedger', () => {
  it('starts at 0 for a missing file and creates parent directories on write', () => {
    const path = join(dir(), 'a', 'b', 'ledger.json')
    const ledger = fileLedger(path, 3, () => new Date('2026-10-22T10:00:00Z'))
    expect(ledger.spent()).toBe(0)
    ledger.add(0.25)
    ledger.add(0.5)
    expect(ledger.spent()).toBeCloseTo(0.75)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ month: '2026-10', usd: 0.75, calls: 2 })
  })

  it('persists across instances', () => {
    const path = join(dir(), 'ledger.json')
    const now = () => new Date('2026-10-22T10:00:00Z')
    fileLedger(path, 3, now).add(1)
    expect(fileLedger(path, 3, now).spent()).toBe(1)
  })

  it('resets when the UTC month changes', () => {
    const path = join(dir(), 'ledger.json')
    fileLedger(path, 3, () => new Date('2026-10-31T23:59:59Z')).add(2)
    const next = fileLedger(path, 3, () => new Date('2026-11-01T00:00:01Z'))
    expect(next.spent()).toBe(0)
    next.add(0.1)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ month: '2026-11', usd: 0.1, calls: 1 })
  })

  it('treats a corrupt file as 0', () => {
    const path = join(dir(), 'ledger.json')
    writeFileSync(path, '{not json')
    const ledger = fileLedger(path, 3, () => new Date('2026-10-22T00:00:00Z'))
    expect(ledger.spent()).toBe(0)
    ledger.add(0.2)
    expect(ledger.spent()).toBeCloseTo(0.2)
  })

  it('exposes the cap, null meaning none', () => {
    expect(fileLedger(join(dir(), 'l.json'), null).capUsd).toBeNull()
    expect(fileLedger(join(dir(), 'l.json'), 3).capUsd).toBe(3)
  })
})
