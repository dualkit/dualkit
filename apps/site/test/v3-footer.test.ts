import { describe, expect, it } from 'vitest'
import { footerColumns, FOOTER_LINKS } from '../lib/v3/footer'
import { V3 } from '../lib/v3/copy'

describe('v3 footer links', () => {
  it('maps every column label from the copy', () => {
    const cols = footerColumns()
    expect(cols.map((c) => c.title)).toEqual(V3.footer.columns.map(([t]) => t))
    expect(cols.flatMap((c) => c.links).length).toBe(V3.footer.columns.flatMap(([, l]) => l).length)
  })
  it('uses routes that exist or absolute https urls', () => {
    for (const href of Object.values(FOOTER_LINKS)) {
      if (href) expect(/^(\/|https:\/\/)/.test(href)).toBe(true)
    }
  })
  it('has no em dashes', () => {
    expect(JSON.stringify(V3.footer) + JSON.stringify(V3.seals)).not.toContain('—')
  })
})
