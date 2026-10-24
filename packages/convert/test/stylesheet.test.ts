import { parseSourceOutcome } from '@dualkit/lint'
import { MIN_ARABIC_SIZE } from '@dualkit/rules'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { dualkitCss, importEdit, stylesheetPath } from '../src/generate/stylesheet'
import type { Project } from '../src/types'

const next: Project = { root: '/r', framework: 'next-app', appDir: 'app', entry: 'app/layout.tsx', tailwind: 'v4', i18n: null, packageManager: 'npm' }
const vite: Project = { ...next, framework: 'vite-react', appDir: null, entry: 'src/main.tsx', tailwind: null }

function source(path: string, text: string) {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  return outcome.file
}

describe('stylesheetPath', () => {
  it('is in the app directory for Next and in src for Vite', () => {
    expect(stylesheetPath(next)).toBe('app/dualkit.css')
    expect(stylesheetPath({ ...next, appDir: 'src/app' })).toBe('src/app/dualkit.css')
    expect(stylesheetPath(vite)).toBe('src/dualkit.css')
  })
})

describe('dualkitCss', () => {
  const css = dualkitCss(next)

  it('holds each rule in order', () => {
    const parts = [
      '@import url(',
      'IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap',
      ":lang(ar) {",
      "font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif",
      'line-height: 1.7',
      ':lang(ar) * {',
      'letter-spacing: 0',
      ':lang(ar) .text-xs, :lang(ar) .text-\\[10px\\], :lang(ar) .text-\\[11px\\], :lang(ar) .text-\\[12px\\], :lang(ar) .text-\\[13px\\] {',
      `font-size: ${MIN_ARABIC_SIZE}px`,
      '[dir="rtl"] [data-dk-mirror] {',
      'scale: -1 1',
      '[dir="rtl"] input[dir="ltr"]:placeholder-shown, [dir="rtl"] textarea[dir="ltr"]:placeholder-shown {',
      'direction: rtl',
    ]
    let at = -1
    for (const part of parts) {
      const next = css.indexOf(part, at + 1)
      expect(next, part).toBeGreaterThan(at)
      at = next
    }
  })

  it('scopes every rule to :lang(ar) or [dir="rtl"]', () => {
    const root = postcss.parse(css)
    const selectors: string[] = []
    root.walkRules((rule) => void selectors.push(...rule.selectors))
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) expect(selector, selector).toMatch(/^(:lang\(ar\)|\[dir="rtl"\])/)
  })

  it('leaves out the small-text rule without Tailwind', () => {
    const plain = dualkitCss(vite)
    expect(plain).not.toContain('.text-xs')
    expect(plain).toContain(':lang(ar) *')
  })
})

describe('importEdit', () => {
  const layout = "import './globals.css'\nimport type { Metadata } from 'next'\n\nexport const metadata = {}\n"

  it('adds the import after the last import and is idempotent', () => {
    const file = source('app/layout.tsx', layout)
    const edit = importEdit(file, 'app/dualkit.css')
    expect(edit).not.toBeNull()
    const out = applyEdits(file.text, [edit!])
    expect(out).toBe("import './globals.css'\nimport type { Metadata } from 'next'\nimport './dualkit.css'\n\nexport const metadata = {}\n")
    expect(importEdit(source('app/layout.tsx', out), 'app/dualkit.css')).toBeNull()
  })

  it('uses the path relative to the entry', () => {
    const file = source('src/main.tsx', "import React from 'react'\n")
    expect(applyEdits(file.text, [importEdit(file, 'src/dualkit.css')!])).toBe("import React from 'react'\nimport './dualkit.css'\n")
    const nested = source('src/app/layout.tsx', "import a from 'a'\n")
    expect(applyEdits(nested.text, [importEdit(nested, 'src/dualkit.css')!])).toContain("import '../dualkit.css'")
    const root = source('main.tsx', "import a from 'a'\n")
    expect(applyEdits(root.text, [importEdit(root, 'src/dualkit.css')!])).toContain("import './src/dualkit.css'")
  })

  it('inserts at the top when there are no imports, after a directive', () => {
    const plain = source('src/main.tsx', 'export const a = 1\n')
    expect(applyEdits(plain.text, [importEdit(plain, 'src/dualkit.css')!])).toBe("import './dualkit.css'\nexport const a = 1\n")
    const client = source('app/layout.tsx', "'use client'\n\nexport const a = 1\n")
    expect(applyEdits(client.text, [importEdit(client, 'app/dualkit.css')!])).toBe("'use client'\nimport './dualkit.css'\n\nexport const a = 1\n")
  })

  it('keeps semicolons when the file uses them', () => {
    const file = source('src/main.tsx', "import a from 'a';\n")
    expect(applyEdits(file.text, [importEdit(file, 'src/dualkit.css')!])).toBe("import a from 'a';\nimport './dualkit.css';\n")
  })
})
