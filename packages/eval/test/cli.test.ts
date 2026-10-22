import { describe, expect, it } from 'vitest'
import { parseArgs, resolveData } from '../src/cli.js'

describe('data folder', () => {
  it('reads --data, then DUALKIT_SWEEP_DATA, and fails with a clear message when neither is set', () => {
    expect(resolveData('/a', { DUALKIT_SWEEP_DATA: '/b' })).toBe('/a')
    expect(resolveData(undefined, { DUALKIT_SWEEP_DATA: '/b' })).toBe('/b')
    expect(() => resolveData(undefined, {})).toThrow(/--data <dir> or set DUALKIT_SWEEP_DATA/)
  })

  it('parses the command and the flag', () => {
    expect(parseArgs(['all', '--data', '/x'])).toEqual({ command: 'all', data: '/x' })
    expect(parseArgs(['misses'])).toEqual({ command: 'misses', data: undefined })
    expect(() => parseArgs(['nope'])).toThrow(/Usage/)
    expect(() => parseArgs(['all', '--data'])).toThrow(/needs a folder/)
  })
})
