import { describe, expect, it } from 'vitest'
import { downloadsLine, footerColumns, FOOTER_LINKS } from '../lib/v3/footer'
import { SEAL_MARKS } from '../lib/v3/seal-glyphs'
import { V3 } from '../lib/v3/copy'

describe('v3 seals', () => {
  it('has a mark for every seal', () => {
    for (const [id] of V3.seals) expect(id in SEAL_MARKS).toBe(true)
  })
  it('uses a logo only for the OSI mark, served from the site and linked to opensource.org', () => {
    const logos = Object.entries(SEAL_MARKS).filter(([, m]) => m.kind === 'logo')
    expect(logos.map(([id]) => id)).toEqual(['MIT'])
    for (const [, m] of logos) if (m.kind === 'logo') {
      expect(m.src.startsWith('/v3/marks/')).toBe(true)
      expect(m.href.startsWith('https://opensource.org/')).toBe(true)
    }
  })
  it('claims no native Arabic review, which has not happened', () => {
    expect(JSON.stringify(V3.seals).toLowerCase()).not.toContain('native')
    expect(JSON.stringify(V3.seals).toLowerCase()).not.toContain('arabic review')
  })
  it('keeps text seals short enough for the ring', () => {
    for (const m of Object.values(SEAL_MARKS)) if (m.kind === 'text') expect(m.text.length).toBeLessThanOrEqual(5)
  })
  it('credits the OSI trademarks in the footer', () => {
    expect(V3.footer.trademarks).toContain('OSI® and Open Source Initiative® are trademarks of the Open Source Initiative.')
  })
})

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
  it('has no Privacy link', () => {
    expect(JSON.stringify(V3.footer.columns)).not.toContain('Privacy')
  })
  it('has no em dashes', () => {
    expect(JSON.stringify(V3.footer) + JSON.stringify(V3.seals)).not.toContain('—')
  })
})

describe('downloadsLine', () => {
  it('hides the line until npm reports a count above zero', () => {
    expect(downloadsLine(null)).toBeNull()
    expect(downloadsLine(0)).toBeNull()
  })

  it('shows the compact weekly count in the v2 wording', () => {
    expect(downloadsLine(1234)).toBe('1.2k npm downloads last week')
    expect(downloadsLine(87)).toBe('87 npm downloads last week')
  })
})

describe('v3 footer products', () => {
  it('links every product, the Gulf components, MCP and Figma included', () => {
    const product = footerColumns().find((c) => c.title === 'Product')
    expect(product?.links).toEqual([
      { label: 'Skills', href: '/docs#skills' },
      { label: 'Format', href: '/docs#format' },
      { label: 'Starter', href: '/docs#starter' },
      { label: 'Gulf components', href: '/components/gulf' },
      { label: 'Check', href: '/docs#check' },
      { label: 'Lint', href: '/docs#lint' },
      { label: 'Convert', href: '/convert' },
      { label: 'MCP', href: '/docs#mcp' },
      { label: 'Figma', href: '/docs#figma' },
      { label: 'Bench', href: '/bench' },
    ])
  })
})
