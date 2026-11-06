import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GulfDemo } from '../components/gulf/GulfDemos'
import { GULF_COPY, GULF_SLUGS, gulfInstall } from '../lib/gulf-copy'

type Entry = { value: string; path: string[] }
function strings(node: unknown, path: string[] = []): Entry[] {
  if (typeof node === 'string') return [{ value: node, path }]
  if (Array.isArray(node)) return node.flatMap((child, i) => strings(child, [...path, String(i)]))
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]))
  return []
}

const ARABIC = /[؀-ۿ]/
const all = strings(GULF_COPY)
const english = all.filter((e) => !e.path.includes('ar'))
const REGISTRY = join(__dirname, '../public/r')

describe('Gulf components copy', () => {
  it('has no em dashes', () => {
    for (const { value, path } of all) expect(value, path.join('.')).not.toContain('—')
  })

  it('keeps every Arabic string under an ar key, and none elsewhere', () => {
    for (const { value, path } of all) expect(ARABIC.test(value), `${path.join('.')}: ${value}`).toBe(path.includes('ar'))
  })

  it('makes no claims and names no city', () => {
    const claims = /\b(best|the only|the first|fastest|perfect|seamless|effortless|powerful|revolutionary|guarantee)\b/i
    const places = /\b(Dubai|Abu Dhabi|Riyadh|Jeddah|Doha|Kuwait City|Manama|Muscat|based in)\b/i
    for (const { value, path } of english) {
      expect(value, path.join('.')).not.toMatch(claims)
      expect(value, path.join('.')).not.toMatch(places)
    }
  })

  it('points every install command at a registry file that exists', () => {
    for (const slug of GULF_SLUGS) {
      expect(gulfInstall(slug)).toBe(`npx shadcn@latest add https://dualkit.dev/r/${slug}.json`)
      expect(existsSync(join(REGISTRY, `${slug}.json`)), slug).toBe(true)
    }
    const index = JSON.parse(readFileSync(join(REGISTRY, 'registry.json'), 'utf8')) as { items: { name: string }[] }
    for (const slug of GULF_SLUGS) expect(index.items.map((i) => i.name)).toContain(slug)
  })
})

describe('Gulf demos', () => {
  it.each(GULF_SLUGS)('renders %s in English and Arabic, each in its own direction', (slug) => {
    const html = renderToStaticMarkup(<GulfDemo slug={slug} />)
    const item = GULF_COPY.items[slug]
    expect(html).toContain('dir="ltr" lang="en"')
    expect(html).toContain('dir="rtl" lang="ar"')
    expect(html).toContain(item.en.label)
    expect(html).toContain(item.ar.label)
    expect(html).toContain('&quot;ok&quot;:true')
  })

  it('shows the Arabic amount with Arabic-Indic digits and the Hijri date in both languages', () => {
    expect(renderToStaticMarkup(<GulfDemo slug="gulf-amount" />)).toContain('١٬٢٥٠٫١٢٥')
    const dates = renderToStaticMarkup(<GulfDemo slug="gulf-hijri-date" />)
    expect(dates).toContain('2 Jumada al-Awwal 1448 AH')
    expect(dates).toContain('٢ جمادى الأولى ١٤٤٨ هـ')
  })
})
