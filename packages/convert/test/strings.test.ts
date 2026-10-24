import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { extractStrings } from '../src/transforms/strings'

type Lib = 'next-intl' | 'react-i18next'

function run(text: string, path = 'app/page.tsx', lib: Lib = 'next-intl', taken = new Set<string>()) {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = extractStrings(outcome.file, lib, taken)
  return { ...result, out: applyEdits(text, result.edits) }
}

const home = (body: string): string =>
  `import Link from 'next/link'\n\nexport default function Home() {\n  return (\n    <main>\n${body}\n    </main>\n  )\n}\n`

describe('extractStrings text', () => {
  it('replaces JSX text and adds the hook and import once for two strings', () => {
    const { out, entries } = run(home('      <h1>Welcome back</h1>\n      <p>Your orders</p>'))
    expect(out).toBe(
      `import Link from 'next/link'\nimport { useTranslations } from 'next-intl'\n\nexport default function Home() {\n` +
      `  const t = useTranslations()\n  return (\n    <main>\n` +
      `      <h1>{t('home.welcome-back')}</h1>\n      <p>{t('home.your-orders')}</p>\n    </main>\n  )\n}\n`,
    )
    expect(entries).toEqual([
      { key: 'home.welcome-back', en: 'Welcome back', ar: '', status: 'pending', file: 'app/page.tsx', line: 6 },
      { key: 'home.your-orders', en: 'Your orders', ar: '', status: 'pending', file: 'app/page.tsx', line: 7 },
    ])
  })

  it('keeps surrounding whitespace and collapses inner whitespace for en', () => {
    const { out, entries } = run('export function Card() {\n  return <p>\n    Read   the\n    terms\n  </p>\n}\n')
    expect(out).toContain(`<p>\n    {t('home.read-the-terms')}\n  </p>`)
    expect(entries[0]!.en).toBe('Read the terms')
  })

  it('extracts a string literal child', () => {
    const { out } = run(`export const Card = () => {\n  return <p>{'Hello there'}</p>\n}\n`)
    expect(out).toContain(`<p>{t('home.hello-there')}</p>`)
  })

  it('ignores text without a letter', () => {
    expect(run(`export const Card = () => {\n  return <p>42 / 7</p>\n}\n`).edits).toEqual([])
  })

  it('makes keys from the kebab file stem and four ASCII words, deduplicated against taken', () => {
    const text = 'export function Hero() {\n  return <h1>Café opens at nine today</h1>\n}\n'
    const { out, entries } = run(text, 'src/HeroBanner.tsx', 'next-intl', new Set(['hero-banner.cafe-opens-at-nine']))
    expect(out).toContain(`{t('hero-banner.cafe-opens-at-nine-2')}`)
    expect(entries.map((e) => e.key)).toEqual(['hero-banner.cafe-opens-at-nine-2'])
  })

  it('does not mutate taken and reuses a key for the same text in one file', () => {
    const taken = new Set(['home.save'])
    const { out, entries } = run('export function A() {\n  return <div><b>Save</b><i>Save</i></div>\n}\n', 'app/page.tsx', 'next-intl', taken)
    expect([...taken]).toEqual(['home.save'])
    expect(entries.map((e) => e.key)).toEqual(['home.save-2'])
    expect(out.match(/t\('home\.save-2'\)/g)).toHaveLength(2)
  })
})

describe('extractStrings keys for route files', () => {
  const key = (path: string): string => run('export default function P() {\n  return <h1>Plans and prices</h1>\n}\n', path).entries[0]!.key

  it('uses the route directory for page, layout, index, route and default files', () => {
    expect(key('app/page.tsx')).toBe('home.plans-and-prices')
    expect(key('app/pricing/page.tsx')).toBe('pricing.plans-and-prices')
    expect(key('src/app/orders/[id]/page.tsx')).toBe('orders-id.plans-and-prices')
    expect(key('app/(shop)/cart/layout.tsx')).toBe('cart.plans-and-prices')
    expect(key('app/(marketing)/page.tsx')).toBe('home.plans-and-prices')
    expect(key('app/docs/[...slug]/default.tsx')).toBe('docs-slug.plans-and-prices')
    expect(key('src/pages/index.tsx')).toBe('pages.plans-and-prices')
    expect(key('index.tsx')).toBe('home.plans-and-prices')
  })

  it('keeps the file stem for other files', () => {
    expect(key('app/pricing/PlanCard.tsx')).toBe('plan-card.plans-and-prices')
  })
})

describe('extractStrings attributes', () => {
  it('replaces placeholder and leaves className alone', () => {
    const { out, entries } = run('export function Search() {\n  return <input className="mt-2" placeholder="Search" />\n}\n')
    expect(out).toContain(`<input className="mt-2" placeholder={t('home.search')} />`)
    expect(entries.map((e) => e.en)).toEqual(['Search'])
  })

  it('handles alt, title, aria-label and label, and an expression string', () => {
    const { out } = run(`export function A() {\n  return <div title="Tip" aria-label={'Close menu'}><img alt="Logo" /><Field label="Email" /></div>\n}\n`)
    expect(out).toContain(`title={t('home.tip')}`)
    expect(out).toContain(`aria-label={t('home.close-menu')}`)
    expect(out).toContain(`alt={t('home.logo')}`)
    expect(out).toContain(`label={t('home.email')}`)
  })

  it('never touches href, src, id, key, type, name, data-* or style', () => {
    const text = `export function A() {\n  return <a href="Home" id="Main" key="One" type="Button" name="Field" data-x="Hello" src="Pic">{''}</a>\n}\n`
    expect(run(text).edits).toEqual([])
  })
})

describe('extractStrings interpolation and mixed text', () => {
  it('turns Hello {name} into a call with values', () => {
    const { out, entries } = run('export function Home({ name }) {\n  return <p>Hello {name}</p>\n}\n', 'app/home.tsx')
    expect(out).toContain(`<p>{t('home.hello', { name })}</p>`)
    expect(entries[0]!.en).toBe('Hello {name}')
  })

  it('uses the last property of a member expression as the placeholder', () => {
    const { out, entries } = run('export function Home({ user }) {\n  return <p>Hi {user.name}, welcome</p>\n}\n', 'app/home.tsx')
    expect(out).toContain(`{t('home.hi-welcome', { name: user.name })}`)
    expect(entries[0]!.en).toBe('Hi {name}, welcome')
  })

  it('flags text whose element also holds a child element and leaves it', () => {
    const text = 'export function Home({ name }) {\n  return <p>Hello <b>{name}</b></p>\n}\n'
    const { edits, flags, entries } = run(text)
    expect(edits).toEqual([])
    expect(entries).toEqual([])
    expect(flags).toMatchObject([{ kind: 'mixed-text', line: 2, file: 'app/page.tsx' }])
  })

  it('treats a bdi wrapper from the markup pass as mixed text', () => {
    const { edits, flags } = run('export function Home({ price }) {\n  return <p>Total <bdi>{price}</bdi></p>\n}\n')
    expect(edits).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(['mixed-text'])
  })

  it('extracts text next to an element with no text, like an icon', () => {
    const { out, flags } = run('export function A() {\n  return <button><Icon /> Save</button>\n}\n')
    expect(out).toContain(`<button><Icon /> {t('home.save')}</button>`)
    expect(flags).toEqual([])
  })

  it('extracts each run between icons and line breaks on its own', () => {
    const { out } = run('export function A() {\n  return <p>First line<br />Second line <Icon size={4} /></p>\n}\n')
    expect(out).toContain(`<p>{t('home.first-line')}<br />{t('home.second-line')} <Icon size={4} /></p>`)
  })

  it('still flags a run next to an element with text, even after an icon', () => {
    const { edits, flags } = run('export function A() {\n  return <p><Icon />Saved <b>today</b></p>\n}\n')
    expect(edits.filter((e) => e.text.includes('saved'))).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(['mixed-text'])
  })

  it('flags a plural-looking expression and leaves it', () => {
    const { edits, flags } = run(`export function Cart({ count }) {\n  return <p>{count} item{count === 1 ? '' : 's'}</p>\n}\n`)
    expect(edits).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(['mixed-text'])
  })

  it('flags placeholders that collide', () => {
    const { edits, flags } = run('export function A({ a, b }) {\n  return <p>From {a.name} to {b.name}</p>\n}\n')
    expect(edits).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(['mixed-text'])
  })
})

describe('extractStrings hooks', () => {
  it('gives an async server component getTranslations', () => {
    const { out } = run('export default async function Page() {\n  const data = await load()\n  return <h1>Orders</h1>\n}\n')
    expect(out).toBe(
      `import { getTranslations } from 'next-intl/server'\nexport default async function Page() {\n` +
      `  const t = await getTranslations()\n  const data = await load()\n  return <h1>{t('home.orders')}</h1>\n}\n`,
    )
  })

  it('turns an expression-bodied arrow into a block', () => {
    const { out } = run(`'use client'\nimport { x } from './x'\n\nexport const Badge = () => (\n  <span>New</span>\n)\n`)
    expect(out).toBe(
      `'use client'\nimport { x } from './x'\nimport { useTranslations } from 'next-intl'\n\nexport const Badge = () => {\n` +
      `  const t = useTranslations()\n  return (\n  <span>{t('home.new')}</span>\n)\n}\n`,
    )
  })

  it('handles a bare arrow body, a one-line block and a memo wrapper', () => {
    expect(run('export const A = () => <b>Hi</b>\n').out)
      .toBe(`import { useTranslations } from 'next-intl'\nexport const A = () => {\n  const t = useTranslations()\n  return <b>{t('home.hi')}</b>\n}\n`)
    expect(run('function A() { return <b>Hi</b> }\n').out).toContain(`function A() { const t = useTranslations(); return <b>{t('home.hi')}</b> }`)
    expect(run('const A = memo(function () {\n  return <b>Hi</b>\n})\n').out).toContain('memo(function () {\n  const t = useTranslations()\n  return')
  })

  it('works on code the markup pass already edited', () => {
    const text = `import { ChevronRight } from 'lucide-react'\nexport const A = () => <a href="/n">Next <ChevronRight data-dk-mirror="" /></a>\n`
    expect(run(text).out).toContain(`<a href="/n">{t('home.next')} <ChevronRight data-dk-mirror="" /></a>`)
    const plain = `import { ChevronRight } from 'lucide-react'\nexport const A = () => <a href="/n"><ChevronRight data-dk-mirror="" /><span>Next</span></a>\n`
    expect(run(plain).out).toContain(`<span>{t('home.next')}</span>`)
  })

  it('puts the hook in the nearest PascalCase function, not a callback', () => {
    const { out } = run(`export function List({ items }) {\n  return <ul>{items.map((i) => <li key={i}>Item</li>)}</ul>\n}\n`)
    expect(out).toContain('export function List({ items }) {\n  const t = useTranslations()\n  return')
    expect(out).toContain(`<li key={i}>{t('home.item')}</li>`)
  })

  it('uses react-i18next', () => {
    const { out } = run(`import React from 'react';\n\nexport function A() {\n  return <h1>Hi</h1>;\n}\n`, 'src/App.tsx', 'react-i18next')
    expect(out).toBe(
      `import React from 'react';\nimport { useTranslation } from 'react-i18next';\n\nexport function A() {\n` +
      `  const { t } = useTranslation();\n  return <h1>{t('app.hi')}</h1>;\n}\n`,
    )
  })

  it('adds one import for two components', () => {
    const { out } = run('function A() {\n  return <b>One</b>\n}\nfunction B() {\n  return <b>Two</b>\n}\n')
    expect(out.match(/import \{ useTranslations \}/g)).toHaveLength(1)
    expect(out.match(/const t = useTranslations\(\)/g)).toHaveLength(2)
  })
})

describe('extractStrings outside components', () => {
  it('flags a module-level label list', () => {
    const { edits, flags } = run(`const LABELS = ['One']\n\nexport function A() {\n  return <b>{LABELS[0]}</b>\n}\n`)
    expect(edits).toEqual([])
    expect(flags).toMatchObject([{ kind: 'outside-component', line: 1 }])
  })

  it('flags JSX text in a lowercase helper', () => {
    const { edits, flags } = run('function row() {\n  return <td>Name</td>\n}\n')
    expect(edits).toEqual([])
    expect(flags).toMatchObject([{ kind: 'outside-component', line: 2 }])
  })

  it('does not flag module-level strings that are not prose', () => {
    expect(run(`const CLS = ['mt-2 flex', 'GET', '/home']\nexport function A() {\n  return <b />\n}\n`).flags).toEqual([])
  })
})

describe('extractStrings safety', () => {
  it('leaves a use server file alone', () => {
    const text = `'use server'\nexport async function Save() {\n  return <p>Saved</p>\n}\n`
    expect(run(text)).toMatchObject({ edits: [], flags: [], entries: [] })
  })

  it('changes nothing on its own output', () => {
    const text = `export default function Home({ name }) {\n  return <main><h1>Welcome back</h1><p>Hello {name}</p><input placeholder="Search" /></main>\n}\n`
    const first = run(text)
    expect(first.entries).toHaveLength(3)
    const second = run(first.out, 'app/page.tsx', 'next-intl', new Set(first.entries.map((e) => e.key)))
    expect(second.edits).toEqual([])
    expect(second.entries).toEqual([])
  })
})
