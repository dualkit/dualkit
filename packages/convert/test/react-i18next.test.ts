import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { wireReactI18next } from '../src/generate/react-i18next'
import type { Project } from '../src/types'
import { fixtureDir, projectFiles } from './helpers'

const project: Project = { root: '/r', framework: 'vite-react', appDir: null, entry: 'src/main.tsx', tailwind: 'v3', i18n: null, packageManager: 'npm' }
const { files } = projectFiles(fixtureDir('vite-app'))

function parses(path: string, text: string): void {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(`${path}: ${outcome.error}`)
}

const edited = (plan: ReturnType<typeof wireReactI18next>, path: string): string => applyEdits(files(path)!, plan.edits[path] ?? [])

describe('wireReactI18next bilingual', () => {
  const plan = wireReactI18next(project, 'bilingual', files)

  it('writes the i18n init with both locales from the cookie and brace placeholders', () => {
    const init = plan.writes['src/i18n.ts']!
    expect(init).toContain("import { initReactI18next } from 'react-i18next'")
    expect(init).toContain("import en from '../messages/en.json'")
    expect(init).toContain("import ar from '../messages/ar.json'")
    expect(init).toContain('dk-locale')
    expect(init).toContain("interpolation: { prefix: '{', suffix: '}', escapeValue: false }")
    expect(init).toContain('initAsync: false')
    expect(init).toContain("fallbackLng: 'en'")
    parses('src/i18n.ts', init)
  })

  it('adds an inline script that reads dk-locale and sets lang and dir before first paint', () => {
    const html = edited(plan, 'index.html')
    const head = html.indexOf('<head>')
    const script = html.indexOf('<script>')
    expect(script).toBeGreaterThan(head)
    expect(script).toBeLessThan(html.indexOf('<meta'))
    expect(html).toMatch(/<script>[^<]*dk-locale[^<]*\.dir *=[^<]*<\/script>/)
    expect(html).toContain('<html lang="en">')
  })

  it('imports the i18n init in the entry', () => {
    expect(edited(plan, 'src/main.tsx')).toContain("import './i18n'\n")
    parses('src/main.tsx', edited(plan, 'src/main.tsx'))
  })

  it('writes the switch that sets the cookie and reloads', () => {
    const sw = plan.writes['src/components/dualkit-language-switch.tsx']!
    expect(sw).toContain('dk-locale=')
    expect(sw).toContain('window.location.reload()')
    expect(sw).toContain('العربية')
    expect(sw).not.toContain('—')
    parses('src/components/dualkit-language-switch.tsx', sw)
  })

  it('writes the locale helper and pins both dependencies', () => {
    expect(plan.writes['src/lib/dualkit-locale.ts']).toContain("'ar-AE-u-nu-latn'")
    expect(plan.deps).toEqual({ 'react-i18next': '17.1.6', i18next: '26.5.8' })
    expect(plan.moves).toEqual([])
  })

  it('does not write messages', () => {
    expect(Object.keys(plan.writes).some((p) => p.startsWith('messages/'))).toBe(false)
  })

  it('changes nothing already wired on a second run', () => {
    const wired = (path: string): string | null => (path === 'src/main.tsx' || path === 'index.html' ? edited(plan, path) : files(path))
    const again = wireReactI18next(project, 'bilingual', wired)
    expect(again.edits).toEqual({})
  })
})

describe('wireReactI18next arabic', () => {
  const plan = wireReactI18next(project, 'arabic', files)

  it('fixes the locale to ar with only Arabic resources and no switch', () => {
    const init = plan.writes['src/i18n.ts']!
    expect(init).toContain("lng: 'ar'")
    expect(init).not.toContain('en.json')
    expect(init).not.toContain('document.cookie')
    expect(plan.writes['src/components/dualkit-language-switch.tsx']).toBeUndefined()
  })

  it('sets the html element to Arabic and right to left without a script', () => {
    const html = edited(plan, 'index.html')
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).not.toContain('<script>')
  })
})
