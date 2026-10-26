import { describe, expect, it } from 'vitest'
import { CAREERS, ROLES, roleBySlug } from '../lib/careers'

const prose = () => JSON.stringify({ CAREERS, ROLES })

describe('careers roles', () => {
  it('lists the Arabic translator and the frontend engineer', () => {
    expect(ROLES.map((r) => r.slug)).toEqual(['frontend-engineer', 'arabic-translator'])
  })

  it('finds a role by slug and nothing for an unknown one', () => {
    expect(roleBySlug('arabic-translator')?.title).toBe('Arabic translator')
    expect(roleBySlug('nope')).toBeNull()
  })

  it('uses url-safe slugs', () => {
    for (const r of ROLES) expect(/^[a-z0-9-]+$/.test(r.slug)).toBe(true)
  })

  it('gives every role a summary and filled sections', () => {
    for (const r of ROLES) {
      expect(r.summary.length).toBeGreaterThan(0)
      expect(r.sections.length).toBeGreaterThan(0)
      for (const s of r.sections) expect(s.items.length).toBeGreaterThan(0)
    }
  })

  it('never mentions pay', () => {
    expect(prose()).not.toMatch(/salary|wage|\bpay\b|compensation|AED|USD|\$/i)
  })

  it('has no em or en dashes', () => {
    expect(prose()).not.toMatch(/[—–]/)
  })
})
