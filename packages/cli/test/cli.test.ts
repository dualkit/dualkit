import { describe, expect, it } from 'vitest'
import type { AuditResult } from '../src/audit'
import { run } from '../src/cli'

const fake = (score = 80): AuditResult => ({
  url: 'https://example.com/', date: '2026-10-16T00:00:00.000Z', width: 1280, height: 800, score, findings: [],
  screenshot: '', pageHeight: 800, unreadableStylesheets: 0,
})

const io = (score = 80) => {
  const out: string[] = []
  const err: string[] = []
  const files: Record<string, string> = {}
  const calls: unknown[] = []
  return {
    out, err, files, calls,
    io: {
      out: (s: string) => out.push(s), err: (s: string) => err.push(s), write: (p: string, d: string) => { files[p] = d },
      audit: async (o: unknown) => { calls.push(o); return fake(score) }, cwd: process.cwd(),
    },
  }
}

describe('dualkit check', () => {
  it('audits, prints the summary and writes the report', async () => {
    const t = io()
    expect(await run(['check', 'https://example.com'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('Score 80/100')
    expect(Object.keys(t.files)).toEqual(['dualkit-report.html'])
    expect(t.calls[0]).toMatchObject({ url: 'https://example.com/', width: 1280, height: 800 })
  })

  it('takes width, height and an output path', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--width', '390', '--height', '844', '--out', 'r.html'], t.io)
    expect(t.calls[0]).toMatchObject({ width: 390, height: 844 })
    expect(Object.keys(t.files)).toEqual(['r.html'])
  })

  it('prints JSON with --json', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--json'], t.io)
    expect(JSON.parse(t.out.join('')).score).toBe(80)
  })

  it('exits 1 below --min-score', async () => {
    expect(await run(['check', 'https://example.com', '--min-score', '90'], io(80).io)).toBe(1)
  })

  it('exits 2 with a clear message on bad input', async () => {
    for (const argv of [[], ['lint', 'x'], ['check'], ['check', 'not a page'], ['check', 'https://x.com', '--width', 'wide']]) {
      const t = io()
      expect(await run(argv, t.io), argv.join(' ')).toBe(2)
      expect(t.err.join('').length, argv.join(' ')).toBeGreaterThan(0)
    }
  })

  it('prints help', async () => {
    const t = io()
    expect(await run(['--help'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('dualkit check <url or file>')
  })
})
