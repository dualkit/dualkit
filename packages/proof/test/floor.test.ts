import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const docs = join(__dirname, '..', '..', '..', 'docs', 'proof')
const read = (name: string) => JSON.parse(readFileSync(join(docs, name), 'utf8'))

describe('committed scoreboard', () => {
  it('does not fall below the floor', () => {
    const { summary } = read('scoreboard.json')
    const floor = read('floor.json')
    expect(summary.converted).toBeGreaterThanOrEqual(floor.converted)
    expect(summary.coverage).toBeGreaterThanOrEqual(floor.coverage)
    expect(summary.finished).toBeGreaterThanOrEqual(floor.finished)
    // Every app that built before converting must still build after.
    expect(summary.built).toBe(summary.buildable)
    expect(summary.buildable).toBeGreaterThanOrEqual(floor.buildable)
  })
})
