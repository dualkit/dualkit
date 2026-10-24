import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { markupEdits } from '../src/transforms/markup'

function run(text: string, path = 'src/a.tsx') {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = markupEdits(outcome.file)
  return { ...result, out: applyEdits(text, result.edits) }
}

const withIcon = (source: string, name: string, tag = `<${name} />`): string =>
  `import { ${name} } from '${source}'\nexport const A = () => ${tag}\n`

describe('markupEdits icons', () => {
  it('mirrors a directional icon from a known package', () => {
    const { out } = run(withIcon('lucide-react', 'ChevronRight'))
    expect(out).toBe(withIcon('lucide-react', 'ChevronRight', '<ChevronRight data-dk-mirror="" />'))
  })

  it('matches prefix packages', () => {
    expect(run(withIcon('@heroicons/react/24/outline', 'ArrowLeftIcon')).out).toContain('<ArrowLeftIcon data-dk-mirror="" />')
    expect(run(withIcon('react-icons/fa', 'FaArrowRight')).out).toContain('<FaArrowRight data-dk-mirror="" />')
  })

  it('leaves never-mirror and non-directional icons alone', () => {
    expect(run(withIcon('@heroicons/react/24/outline', 'PlayIcon')).edits).toEqual([])
    expect(run(withIcon('lucide-react', 'CheckIcon')).edits).toEqual([])
    expect(run(withIcon('lucide-react', 'Skip')).edits).toEqual([])
  })

  it('leaves an icon from a local file alone', () => {
    expect(run(withIcon('./icons', 'ChevronRight')).edits).toEqual([])
  })

  it('leaves an icon that already has the attribute', () => {
    const text = withIcon('lucide-react', 'ChevronRight', '<ChevronRight data-dk-mirror="" />')
    expect(run(text).edits).toEqual([])
  })

  it('keeps existing props', () => {
    expect(run(withIcon('lucide-react', 'ChevronRight', '<ChevronRight size={16} />')).out).toContain('<ChevronRight data-dk-mirror="" size={16} />')
  })

  it('flags an inline svg in a back button', () => {
    const { flags, edits } = run('export const A = () => (\n  <button aria-label="Back">\n    <svg viewBox="0 0 1 1" />\n  </button>\n)\n')
    expect(edits).toEqual([])
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ kind: 'inline-svg-icon', line: 3, file: 'src/a.tsx' })
  })

  it('flags an inline svg in a link whose text says next, and not one that says home', () => {
    expect(run('export const A = () => <a href="/n"><svg />Next page</a>\n').flags).toHaveLength(1)
    expect(run('export const A = () => <a href="/"><svg />Home</a>\n').flags).toEqual([])
    expect(run('export const A = () => <a href="/"><svg />Backlog</a>\n').flags).toEqual([])
  })
})

describe('markupEdits numbers', () => {
  const page = (child: string): string => `export const A = ({ price, name, order }) => <p>${child}</p>\n`

  it('wraps price-like identifiers, members and number formatting calls', () => {
    expect(run(page('{price}')).out).toBe(page('<bdi>{price}</bdi>'))
    expect(run(page('{order.total.toFixed(2)}')).out).toBe(page('<bdi>{order.total.toFixed(2)}</bdi>'))
    expect(run(page('{order.total}')).out).toBe(page('<bdi>{order.total}</bdi>'))
    expect(run(page('{n.toLocaleString()}')).out).toBe(page('<bdi>{n.toLocaleString()}</bdi>'))
    expect(run(page('{new Intl.NumberFormat("en").format(x)}')).out).toBe(page('<bdi>{new Intl.NumberFormat("en").format(x)}</bdi>'))
    expect(run(page('{formatMoney(x)}')).out).toBe(page('<bdi>{formatMoney(x)}</bdi>'))
  })

  it('leaves other expressions alone', () => {
    expect(run(page('{name}')).edits).toEqual([])
    expect(run(page('{order.items.map(f)}')).edits).toEqual([])
  })

  it('leaves attributes alone', () => {
    expect(run('export const A = ({ price }) => <p title={price} />\n').edits).toEqual([])
  })

  it('leaves an expression already in bdi or in an element with dir', () => {
    expect(run(page('<bdi>{price}</bdi>')).edits).toEqual([])
    expect(run('export const A = ({ price }) => <p dir="ltr">{price}</p>\n').edits).toEqual([])
  })
})

describe('markupEdits inputs', () => {
  const input = (attrs: string): string => `export const A = () => <input ${attrs} />\n`

  it('adds dir ltr to tel, email and url inputs', () => {
    expect(run(input('type="tel"')).out).toBe('export const A = () => <input dir="ltr" type="tel" />\n')
    expect(run(input('type="email"')).out).toContain('dir="ltr"')
    expect(run(input('type="url"')).out).toContain('dir="ltr"')
  })

  it('leaves text inputs and inputs with dir alone', () => {
    expect(run(input('type="text"')).edits).toEqual([])
    expect(run(input('type="tel" dir="rtl"')).edits).toEqual([])
  })
})

describe('markupEdits idempotence', () => {
  it('finds nothing to change in its own output', () => {
    const text = `import { ChevronRight } from 'lucide-react'\nexport const A = ({ price }) => <p><ChevronRight />{price}<input type="tel" /></p>\n`
    const first = run(text)
    expect(first.edits.length).toBe(4)
    expect(run(first.out).edits).toEqual([])
  })
})
