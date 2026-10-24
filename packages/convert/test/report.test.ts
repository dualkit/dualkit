import { describe, expect, it } from 'vitest'
import { renderConvertReport, type ReportData } from '../src/report'

const base: ReportData = {
  mode: 'bilingual',
  base: 'abc123',
  branch: 'dualkit/bilingual',
  summary: {
    branch: 'dualkit/bilingual',
    filesChanged: 3,
    edits: 9,
    strings: 2,
    skipped: [],
    flags: []
  },
  ledger: [],
  english: [],
  arabic: [],
  unreachable: [],
  remainingLint: 0
}

const HEADINGS = [
  '## What changed',
  '## Arabic copy to check',
  '## Regional suggestions',
  '## English pages',
  '## Arabic pages',
  '## What Dualkit could not convert',
  "## The app's tests"
]

describe('renderConvertReport', () => {
  it('prints every heading in order', () => {
    const out = renderConvertReport({ ...base, tests: { code: 0, tail: 'ok' } })
    const at = HEADINGS.map((h) => out.indexOf(h))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('says so in one line when a section is empty', () => {
    const out = renderConvertReport(base)
    expect(out).toMatch(/## Arabic copy to check\n\n.+\n\n## Regional/)
  })

  it('lists a pending entry with the native speaker line', () => {
    const out = renderConvertReport({
      ...base,
      ledger: [{ key: 'hero.title', en: 'Hello', ar: '', status: 'pending', file: 'app/page.tsx', line: 12 }]
    })
    expect(out).toContain('Drafted by a model. A native speaker should check these before release.')
    expect(out).toContain('hero.title')
    expect(out).toContain('[app/page.tsx:12](app/page.tsx#L12)')
  })

  it('leaves reviewed entries out of the copy section', () => {
    const out = renderConvertReport({
      ...base,
      ledger: [{ key: 'done.key', en: 'Hi', ar: 'مرحبا', status: 'reviewed', file: 'a.tsx', line: 1 }]
    })
    expect(out).not.toContain('done.key')
  })

  it('shows an English ratio of 0.002 as a fail with its diff path', () => {
    const out = renderConvertReport({
      ...base,
      english: [{ route: '/pricing', width: 390, ratio: 0.002, diffPath: '.dualkit/diff/pricing-390.png' }]
    })
    expect(out).toContain('/pricing')
    expect(out).toContain('390')
    expect(out).toMatch(/fail/)
    expect(out).toContain('.dualkit/diff/pricing-390.png')
  })

  it('shows a ratio under the limit as a pass', () => {
    const out = renderConvertReport({ ...base, english: [{ route: '/', width: 1280, ratio: 0 }] })
    expect(out).toMatch(/pass/)
    expect(out).not.toMatch(/fail/)
  })

  it('lists an unreachable route with its reason', () => {
    const out = renderConvertReport({ ...base, unreachable: [{ route: '/account', reason: 'needs a login' }] })
    const section = out.slice(out.indexOf('## What Dualkit could not convert'))
    expect(section).toContain('/account')
    expect(section).toContain('needs a login')
  })

  it('leaves out the English pages section in arabic mode', () => {
    const out = renderConvertReport({ ...base, mode: 'arabic' })
    expect(out).not.toContain('## English pages')
    expect(out).toContain('## Arabic pages')
  })

  it('puts format flags under suggestions and info flags under what changed', () => {
    const out = renderConvertReport({
      ...base,
      summary: {
        ...base.summary,
        flags: [
          { file: 'src/a.tsx', line: 4, kind: 'format', message: 'Price uses USD', suggestion: 'Use AED' },
          { file: 'src/b.tsx', line: 7, kind: 'info', message: 'Added a locale helper', suggestion: '' },
          { file: 'src/c.tsx', line: 9, kind: 'computed-class', message: 'Class is built at runtime', suggestion: 'Use logical classes' }
        ]
      }
    })
    const cut = (a: string, b: string) => out.slice(out.indexOf(a), out.indexOf(b))
    expect(cut('## Regional suggestions', '## English pages')).toContain('Price uses USD')
    expect(cut('## Regional suggestions', '## English pages')).toContain('Use AED')
    expect(cut('## What changed', '## Arabic copy')).toContain('Added a locale helper')
    const notConverted = out.slice(out.indexOf('## What Dualkit could not convert'))
    expect(notConverted).toContain('Class is built at runtime')
    expect(notConverted).not.toContain('Added a locale helper')
  })

  it('lists skipped files and the failing test run', () => {
    const out = renderConvertReport({
      ...base,
      summary: { ...base.summary, skipped: [{ file: 'src/x.ts', reason: 'could not parse' }] },
      tests: { code: 1, tail: 'Tests failed' }
    })
    expect(out).toContain('src/x.ts')
    expect(out).toContain('could not parse')
    expect(out).toContain('Tests failed')
  })

  it('escapes Markdown characters so a table cannot break', () => {
    const out = renderConvertReport({
      ...base,
      ledger: [{ key: 'k', en: 'a | b `c`\nd', ar: 'x|y', status: 'drafted', file: 'a.tsx', line: 1 }]
    })
    const row = out.split('\n').find((l) => l.includes('a \\| b'))!
    expect(row).toBeDefined()
    expect(row).toContain('\\`c\\`')
    expect(row).toContain('x\\|y')
    const unescaped = row.replace(/\\\|/g, '').match(/\|/g)!.length
    const header = out.split('\n').find((l) => l.startsWith('| Key'))!.match(/\|/g)!.length
    expect(unescaped).toBe(header)
  })

  it('has no em dash and no exclamation mark', () => {
    const out = renderConvertReport({
      ...base,
      ledger: [{ key: 'k', en: 'a', ar: 'b', status: 'drafted', file: 'a.tsx', line: 1 }],
      english: [{ route: '/', width: 390, ratio: 0.5, diffPath: 'd.png' }],
      arabic: [{ route: '/', score: 90, errors: 1, warnings: 2 }],
      unreachable: [{ route: '/x', reason: 'r' }],
      tests: { code: 0, tail: 't' }
    })
    expect(out).not.toContain('—')
    expect(out).not.toContain('!')
  })
})
