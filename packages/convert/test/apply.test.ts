import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDependencies, ignoreStateDir } from '../src/apply'
import { readState, saveState, STATE_FILE } from '../src/state'

const dir = (files: Record<string, string> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'dualkit-apply-'))
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(root, rel), text)
  return root
}
const read = (root: string, rel: string): string => readFileSync(join(root, rel), 'utf8')

describe('addDependencies', () => {
  it('adds missing deps sorted, keeps the indent, and leaves declared ones alone', () => {
    const root = dir({ 'package.json': '{\n    "dependencies": { "react": "19.0.0" },\n    "devDependencies": { "i18next": "^25.0.0" }\n}\n' })
    expect(addDependencies(root, { 'react-i18next': '17.1.6', i18next: '26.5.8' })).toBe(true)
    const pkg = JSON.parse(read(root, 'package.json'))
    expect(Object.keys(pkg.dependencies)).toEqual(['react', 'react-i18next'])
    expect(pkg.devDependencies.i18next).toBe('^25.0.0')
    expect(read(root, 'package.json')).toContain('\n    "dependencies"')
    expect(addDependencies(root, { 'react-i18next': '17.1.6' })).toBe(false)
  })

  it('throws when there is no package.json', () => {
    expect(() => addDependencies(dir(), { a: '1.0.0' })).toThrow(/package.json/)
  })
})

describe('ignoreStateDir', () => {
  it('appends .dualkit/ on its own line once', () => {
    const root = dir({ '.gitignore': 'node_modules' })
    expect(ignoreStateDir(root)).toBe(true)
    expect(read(root, '.gitignore')).toBe('node_modules\n.dualkit/\n')
    expect(ignoreStateDir(root)).toBe(false)
  })

  it('accepts an existing .dualkit entry without a slash', () => {
    expect(ignoreStateDir(dir({ '.gitignore': '.dualkit\n' }))).toBe(false)
  })
})

describe('state', () => {
  it('round-trips and is null when missing', () => {
    const root = dir()
    expect(readState(root)).toBeNull()
    const state = { mode: 'arabic', base: 'main', branch: 'dualkit/arabic', framework: 'vite-react', phase: 'converted', generated: ['src/i18n.ts'] } as const
    saveState(root, { ...state, generated: [...state.generated] })
    expect(readState(root)).toEqual(state)
  })

  it('throws on bad JSON and on a missing field', () => {
    const root = dir()
    mkdirSync(join(root, '.dualkit'))
    writeFileSync(join(root, STATE_FILE), '{')
    expect(() => readState(root)).toThrow(/not valid JSON/)
    writeFileSync(join(root, STATE_FILE), '{"mode":"arabic"}')
    expect(() => readState(root)).toThrow(/missing/)
  })
})
