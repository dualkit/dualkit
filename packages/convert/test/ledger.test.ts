import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { type LedgerEntry, mergeLedger, messagesFor, readLedger, writeLedger } from '../src/ledger'
import { extractStrings } from '../src/transforms/strings'

const tempRoot = (): string => mkdtempSync(join(tmpdir(), 'dualkit-ledger-'))

function extract(text: string, taken: Set<string>) {
  const outcome = parseSourceOutcome('app/page.tsx', text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = extractStrings(outcome.file, 'next-intl', taken)
  return { entries: result.entries, out: applyEdits(text, result.edits) }
}

const entry = (key: string, extra: Partial<LedgerEntry> = {}): LedgerEntry =>
  ({ key, en: key, ar: '', status: 'pending', file: 'app/page.tsx', line: 1, ...extra })

describe('ledger files', () => {
  it('reads an empty ledger when the file is missing', () => {
    expect(readLedger(tempRoot())).toEqual([])
  })

  it('writes sorted 2-space JSON with a trailing newline and reads it back', () => {
    const root = tempRoot()
    writeLedger(root, [entry('b.two'), entry('a.one')])
    const raw = readFileSync(join(root, 'dualkit-strings.json'), 'utf8')
    expect(raw).toBe(JSON.stringify([entry('a.one'), entry('b.two')], null, 2) + '\n')
    expect(readLedger(root).map((e) => e.key)).toEqual(['a.one', 'b.two'])
  })

  it('refuses a ledger that is not a list of entries', () => {
    const root = tempRoot()
    writeFileSync(join(root, 'dualkit-strings.json'), '{"key": 1}')
    expect(() => readLedger(root)).toThrow(/dualkit-strings.json/)
    writeFileSync(join(root, 'dualkit-strings.json'), '[{"key": "a"}]')
    expect(() => readLedger(root)).toThrow(/dualkit-strings.json/)
  })

  it('keeps ar and status of existing entries when a second run adds a string', () => {
    const root = tempRoot()
    const source = 'export default function Home() {\n  return <main><h1>Welcome back</h1></main>\n}\n'
    const first = extract(source, new Set())
    writeLedger(root, first.entries)
    writeLedger(root, readLedger(root).map((e) => ({ ...e, ar: 'مرحبا بعودتك', status: 'reviewed' as const })))

    const edited = first.out.replace('</h1>', '</h1><p>Your orders</p>')
    const ledger = readLedger(root)
    const second = extract(edited, new Set(ledger.map((e) => e.key)))
    expect(second.entries.map((e) => e.key)).toEqual(['home.your-orders'])
    writeLedger(root, mergeLedger(ledger, [...second.entries, { ...entry('home.welcome-back'), en: 'Changed' }]))

    const final = readLedger(root)
    expect(final.map((e) => [e.key, e.ar, e.status])).toEqual([
      ['home.welcome-back', 'مرحبا بعودتك', 'reviewed'],
      ['home.your-orders', '', 'pending'],
    ])
    expect(final[0]!.en).toBe('Welcome back')
  })
})

describe('messagesFor', () => {
  const entries = [
    entry('home.welcome-back', { en: 'Welcome back', ar: 'مرحبا بعودتك', status: 'reviewed' }),
    entry('home.your-orders', { en: 'Your orders' }),
    entry('nav.home', { en: 'Home', ar: 'الرئيسية', status: 'drafted' }),
  ]

  it('nests English by dotted key', () => {
    expect(messagesFor(entries, 'en')).toEqual({
      home: { 'welcome-back': 'Welcome back', 'your-orders': 'Your orders' },
      nav: { home: 'Home' },
    })
  })

  it('uses English for a pending Arabic entry', () => {
    expect(messagesFor(entries, 'ar')).toEqual({
      home: { 'welcome-back': 'مرحبا بعودتك', 'your-orders': 'Your orders' },
      nav: { home: 'الرئيسية' },
    })
  })

  it('handles keys that match object prototype names', () => {
    const outcome = parseSourceOutcome('app/page.tsx', 'export function A() {\n  return <main><p>Constructor</p><p>To string</p></main>\n}\n')
    if (!('file' in outcome)) throw new Error(outcome.error)
    const { entries: found } = extractStrings(outcome.file, 'next-intl', new Set())
    expect(found.map((e) => e.key)).toEqual(['home.constructor', 'home.to-string'])
    expect(messagesFor([...found, entry('constructor.name', { en: 'Name' })], 'en'))
      .toEqual({ home: { constructor: 'Constructor', 'to-string': 'To string' }, constructor: { name: 'Name' } })
  })

  it('refuses a key that is both a message and a group', () => {
    expect(() => messagesFor([entry('a'), entry('a.b')], 'en')).toThrow(/a\.b/)
  })
})

describe('messagesFor with hand-edited keys', () => {
  it('keeps __proto__ and constructor keys as plain messages', () => {
    const entry = (key: string) => ({ key, en: key, ar: '', status: 'pending' as const, file: 'a.tsx', line: 1 })
    const messages = messagesFor([entry('__proto__.title'), entry('home.__proto__'), entry('home.constructor')], 'en')
    expect(JSON.parse(JSON.stringify(messages))).toEqual(JSON.parse('{"__proto__":{"title":"__proto__.title"},"home":{"__proto__":"home.__proto__","constructor":"home.constructor"}}'))
    expect(({} as Record<string, unknown>).title).toBeUndefined()
  })
})

describe('mergeLedger duplicates', () => {
  it('keeps the first of two added entries with the same key', () => {
    const entry = (key: string, en: string) => ({ key, en, ar: '', status: 'pending' as const, file: 'a.tsx', line: 1 })
    expect(mergeLedger([], [entry('a', 'one'), entry('a', 'two')]).map((e) => e.en)).toEqual(['one'])
  })
})
