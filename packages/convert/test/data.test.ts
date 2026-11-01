import { describe, expect, it } from 'vitest'
import { liftData } from '../src/transforms/data'

const run = (files: Record<string, string>, lib: 'next-intl' | 'react-i18next' = 'react-i18next') =>
  liftData(Object.entries(files).map(([path, text]) => ({ path, text })), lib, new Set())

const NAV = `export const nav = [{ title: 'Overview', href: '/' }, { title: 'Billing', href: '/billing' }]\n`
const PAGE = `import { nav } from '@/config/nav'\nexport function Menu() {\n  return <ul>{nav.map((n) => <li>{n.title}</li>)}</ul>\n}\n`

describe('liftData', () => {
  it('turns exported data into a function of t and calls it in the importer', () => {
    const result = run({ 'src/config/nav.ts': NAV, 'src/menu.tsx': PAGE })
    expect(result.texts.get('src/config/nav.ts')).toContain(`export const nav = (t: (key: string) => string) => ([{ title: t('nav.overview'), href: '/' }`)
    const page = result.texts.get('src/menu.tsx')!
    expect(page).toContain('nav(t).map(')
    expect(page).toContain('const { t } = useTranslation()')
    expect(page).toContain(`import { useTranslation } from 'react-i18next'`)
    expect(result.entries.map((e) => e.en)).toEqual(['Overview', 'Billing'])
  })
  it('keeps a type annotation as the return type', () => {
    const text = `const items: Item[] = [{ label: 'Open' }]\nexport function A() {\n  return <b>{items[0].label}</b>\n}\n`
    expect(run({ 'src/a.tsx': text }).texts.get('src/a.tsx')).toContain(`const items = (t: (key: string) => string): Item[] => ([{ label: t('a.open') }])`)
  })
  it('follows a renamed import', () => {
    const page = PAGE.replace('{ nav }', '{ nav as links }').replace('nav.map', 'links.map')
    expect(run({ 'src/config/nav.ts': NAV, 'src/menu.tsx': page }).texts.get('src/menu.tsx')).toContain('links(t).map(')
  })
  it('leaves data read at module level, in a helper, or through a type', () => {
    const module = `import { nav } from './nav'\nexport const first = nav[0]\n`
    const helper = `import { nav } from './nav'\nexport function find() {\n  return nav[0]\n}\n`
    const type = `import { nav } from './nav'\ntype N = typeof nav\nexport function A() {\n  return <b>{nav.length}</b>\n}\n`
    for (const text of [module, helper, type]) expect(run({ 'src/nav.ts': NAV, 'src/use.tsx': text }).moved).toBe(0)
  })
  it('leaves data behind a barrel or a namespace import', () => {
    expect(run({ 'src/nav.ts': NAV, 'src/index.ts': `export { nav } from './nav'\n`, 'src/menu.tsx': PAGE }).moved).toBe(0)
    expect(run({ 'src/nav.ts': NAV, 'src/menu.tsx': `import * as all from './nav'\nexport const A = () => <b>{all.nav.length}</b>\n` }).moved).toBe(0)
  })
  it('leaves data nothing reads, and names that Next reads', () => {
    expect(run({ 'src/nav.ts': NAV }).moved).toBe(0)
    expect(run({ 'src/page.tsx': `export const metadata = { title: 'Home' }\nexport default function P() {\n  return <b>{metadata.title}</b>\n}\n` }).moved).toBe(0)
  })
  it('treats name as text only beside a link or icon', () => {
    const people = `const people = [{ name: 'Olivia Martin', email: 'o@x.co' }]\nexport const A = () => <b>{people[0].name}</b>\n`
    expect(run({ 'src/a.tsx': people }).moved).toBe(0)
    const links = `const links = [{ name: 'Settings', href: '/s' }]\nexport const A = () => <b>{links[0].name}</b>\n`
    expect(run({ 'src/a.tsx': links }).moved).toBe(1)
  })
  it('leaves a shadowed name and a t already in scope', () => {
    const shadow = `const nav = [{ title: 'Open' }]\nexport function A({ nav }) {\n  return <b>{nav.length}</b>\n}\n`
    const clash = `const nav = [{ title: 'Open' }]\nexport function A({ t }) {\n  return <b>{nav.length}</b>\n}\n`
    expect(run({ 'src/a.tsx': shadow }).moved).toBe(0)
    expect(run({ 'src/a.tsx': clash }).moved).toBe(0)
  })
  it('leaves a value that is also a string type, and a read in a parameter default', () => {
    const typed = `type Label = 'Comments'\nconst items: { label: Label }[] = [{ label: 'Comments' }]\nexport const A = () => <b>{items.length}</b>\n`
    expect(run({ 'src/a.tsx': typed }).moved).toBe(0)
    const param = `const plans = [{ title: 'Pro' }]\nexport function A({ list = plans }) {\n  return <b>{list.length}</b>\n}\n`
    expect(run({ 'src/a.tsx': param }).moved).toBe(0)
  })
  it('uses the server form in an async next-intl component', () => {
    const page = PAGE.replace('export function Menu', 'export async function Menu')
    expect(run({ 'src/config/nav.ts': NAV, 'src/menu.tsx': page }, 'next-intl').texts.get('src/menu.tsx')).toContain('getTranslations')
    expect(run({ 'src/config/nav.ts': NAV, 'src/menu.tsx': page }).moved).toBe(0)
  })
})
