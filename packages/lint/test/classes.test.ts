import { describe, expect, it } from 'vitest'
import { classStrings } from '../src/classes'
import { parseSource } from '../src/parse'

/** Every whole class token the file yields, in order. */
const tokens = (path: string, text: string): string[] => {
  const file = parseSource(path, text)
  if (!file) throw new Error(`does not parse: ${path}`)
  return classStrings(file).flatMap((f) => f.text.split(/\s+/).filter(Boolean))
}

describe('classStrings offsets', () => {
  it('points each fragment at its text in the file', () => {
    const text = 'const a = <div className="p-1 ml-2" />\nconst b = cn(`x ${y} pr-4`, { "pl-4": z })\n'
    const file = parseSource('a.tsx', text)!
    for (const f of classStrings(file)) expect(text.slice(f.offset, f.offset + f.text.length)).toBe(f.text)
    expect(classStrings(file).length).toBeGreaterThan(0)
  })

  it('points HTML class values and @apply params at the file text', () => {
    for (const [path, text] of [['a.html', '<p class = "a ml-2">x</p><b class=pl-1>y</b>'], ['a.scss', '.a { @apply  ml-2 rtl:mr-2; }']] as const) {
      const file = parseSource(path, text)!
      const frags = classStrings(file)
      expect(frags.length).toBeGreaterThan(0)
      for (const f of frags) expect(text.slice(f.offset, f.offset + f.text.length)).toBe(f.text)
    }
  })
})

describe('classStrings sources', () => {
  it('reads HTML class attributes on every element', () => {
    expect(tokens('a.html', '<div class="ml-2 flex"><span class="pr-4">x</span><svg class="pl-1"></svg></div>')).toEqual(['ml-2', 'flex', 'pr-4', 'pl-1'])
  })

  it('reads JSX className and class string literals and template quasis', () => {
    expect(tokens('a.jsx', '<a className="ml-2" class="pr-1" title="pl-9" />')).toEqual(['ml-2', 'pr-1'])
    expect(tokens('a.tsx', 'export default () => <body className={`${font.variable} ml-4`} />')).toEqual(['ml-4'])
  })

  it('recurses into conditionals, logicals, arrays and class calls inside className', () => {
    expect(tokens('a.jsx', '<a className={on ? "ml-2" : "mr-2"} />')).toEqual(['ml-2', 'mr-2'])
    expect(tokens('a.jsx', '<a className={on && "pl-2"} />')).toEqual(['pl-2'])
    expect(tokens('a.jsx', '<a className={x || "pl-3"} />')).toEqual(['pl-3'])
    expect(tokens('a.jsx', '<a className={["pl-2", on && "pr-2"].join(" ")} />')).toEqual([])
    expect(tokens('a.jsx', '<a className={cn("ml-auto", className)} />')).toEqual(['ml-auto'])
  })

  it('reads clsx, cn, cx, twMerge, twJoin, classnames and classNames arguments', () => {
    expect(tokens('a.ts', "cn('a', cond && 'ml-2', { 'pr-4': x })")).toEqual(['a', 'ml-2', 'pr-4'])
    for (const fn of ['clsx', 'cx', 'twMerge', 'twJoin', 'classnames', 'classNames']) expect(tokens('a.ts', `${fn}('ml-2', ['pl-1'])`), fn).toEqual(['ml-2', 'pl-1'])
  })

  it('reads object keys, not values', () => {
    expect(tokens('a.ts', "clsx({ 'pl-4': active, mr: 'ml-2' })")).toEqual(['pl-4', 'mr'])
  })

  it('reads cva base, variant leaf values and compound class, not defaultVariants or variant names', () => {
    const src = `cva('ml-2', {
      variants: { side: { left: 'pl-2', right: ['pr-2'] } },
      compoundVariants: [{ side: 'left', class: 'mr-1' }],
      defaultVariants: { side: 'left-0' },
    })`
    expect(tokens('a.ts', src)).toEqual(['ml-2', 'pl-2', 'pr-2', 'mr-1'])
  })

  it('reads tv base, slots, variants and compound classes', () => {
    const src = `tv({
      base: 'ml-1',
      slots: { icon: 'pl-1' },
      variants: { size: { sm: { icon: 'pr-1' }, md: 'mr-1' } },
      compoundVariants: [{ size: 'sm', class: 'left-0' }],
      compoundSlots: [{ slots: ['icon'], className: 'right-0' }],
      defaultVariants: { size: 'text-left' },
    })`
    expect(tokens('a.ts', src)).toEqual(['ml-1', 'pl-1', 'pr-1', 'mr-1', 'left-0', 'right-0'])
  })

  it('reads @apply params in CSS and SCSS', () => {
    expect(tokens('a.scss', '.a { @apply ml-2 rtl:mr-2; }')).toEqual(['ml-2', 'rtl:mr-2'])
    expect(tokens('a.css', '.a { @apply pl-2 !important; color: red }')).toEqual(['pl-2', '!important'])
  })
})

describe('classStrings is not a guess', () => {
  it('drops a token cut by a template expression', () => {
    expect(tokens('a.jsx', '<a className={`ml-${n} pr-2`} />')).toEqual(['pr-2'])
    expect(tokens('a.jsx', '<a className={`p-1 ${n}-ml-2 x`} />')).toEqual(['p-1', 'x'])
    expect(tokens('a.ts', "cn('ml-' + n, 'a ' + b)")).toEqual(['a'])
    expect(tokens('a.jsx', "<a className={`p-1 ${on ? 'ml-2' : ''} x`} />")).toEqual(['p-1', 'ml-2', 'x'])
    expect(tokens('a.jsx', "<a className={`ml-${on ? '2' : '4'}`} />")).toEqual([])
  })

  it('ignores other strings, comments and configs', () => {
    expect(tokens('a.ts', "const label = 'ml-2'\n// className=\"ml-2\"\nfoo('pl-2')")).toEqual([])
    expect(tokens('tailwind.config.js', "module.exports = { safelist: ['ml-2', 'pr-4'], content: [] }")).toEqual([])
  })

  it('parses a TSX generic arrow', () => {
    expect(tokens('a.tsx', 'const f = <T,>(x: T) => x\nexport const A = () => <p className="pl-2" />')).toEqual(['pl-2'])
  })

  it('reads class calls in an inline HTML script', () => {
    expect(tokens('a.html', '<div class="a"></div><script>el.className = clsx("ml-2")</script>')).toEqual(['a', 'ml-2'])
  })
})
