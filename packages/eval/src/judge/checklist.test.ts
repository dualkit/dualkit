import { describe, expect, it } from 'vitest'
import { SCREENS } from '@dualkit/bench/src/config'
import { loadChecklist } from './checklist.js'

describe('checklists', () => {
  it.each(SCREENS)('%s has a checklist of 8 to 12 points', (screen) => {
    const list = loadChecklist(screen)
    expect(list.screen).toBe(screen)
    expect(list.points.length).toBeGreaterThanOrEqual(8)
    expect(list.points.length).toBeLessThanOrEqual(12)
    const ids = list.points.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of list.points) {
      expect(p.id).toMatch(/^p\d+$/)
      expect(p.text.length).toBeGreaterThan(0)
      expect(p.text.endsWith('?')).toBe(true)
      expect(p.text).not.toContain('—')
    }
  })

  it.each(SCREENS)('%s asks about spacing and polish', (screen) => {
    const texts = loadChecklist(screen).points.map((p) => p.text)
    expect(texts).toContain('Is the spacing even and the page tidy, with nothing cramped, overlapping or out of line?')
  })

  it('throws for an unknown screen', () => {
    expect(() => loadChecklist('nope')).toThrow()
  })
})
