import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UserError, loadConfig } from '../src/config'

const dir = () => mkdtempSync(join(tmpdir(), 'dualkit-'))

describe('loadConfig', () => {
  it('returns defaults when there is no config file', () => {
    expect(loadConfig(undefined, dir())).toEqual({ ignore: [], exclude: [] })
  })
  it('reads dualkit.config.json from the working folder', () => {
    const d = dir()
    writeFileSync(join(d, 'dualkit.config.json'), JSON.stringify({ ignore: ['type/arabic-size'], exclude: ['.ads'] }))
    expect(loadConfig(undefined, d)).toEqual({ ignore: ['type/arabic-size'], exclude: ['.ads'] })
  })
  it('names an unknown rule id and lists where to find the real ones', () => {
    const d = dir()
    writeFileSync(join(d, 'dualkit.config.json'), JSON.stringify({ ignore: ['type/arabic-sise'] }))
    expect(() => loadConfig(undefined, d)).toThrow(/Unknown rule "type\/arabic-sise"/)
  })
  it('accepts lint rule ids in ignore', () => {
    const d = dir()
    writeFileSync(join(d, 'dualkit.config.json'), JSON.stringify({ ignore: ['source/physical-css', 'type/arabic-size'] }))
    expect(loadConfig(undefined, d).ignore).toEqual(['source/physical-css', 'type/arabic-size'])
  })
  it('rejects broken JSON, wrong types and a missing explicit file', () => {
    const d = dir()
    writeFileSync(join(d, 'bad.json'), '{ ignore: ')
    writeFileSync(join(d, 'types.json'), JSON.stringify({ exclude: '.ads' }))
    expect(() => loadConfig(join(d, 'bad.json'))).toThrow(UserError)
    expect(() => loadConfig(join(d, 'types.json'))).toThrow(/exclude must be a list of CSS selectors/)
    expect(() => loadConfig(join(d, 'missing.json'))).toThrow(/Could not find/)
  })
})
