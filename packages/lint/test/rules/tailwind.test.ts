import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RULES } from '../../src/rules'
import { TAILWIND_MAP } from '../../src/rules/tailwind'
import { lint, lintText } from '../../src/run'
import { tree } from '../helpers'

const ID = 'source/physical-tailwind'
const rules = RULES.filter((r) => r.id === ID)
const run = (text: string, path = 'a.tsx', version: string | null = '3.4.0') =>
  lintText(path, text, { rules, ctx: { tailwindVersion: () => version } })
const jsx = (cls: string, version?: string | null) => run(`export const A = () => <div className="${cls}" />`, 'a.tsx', version)
const fired = (cls: string, version?: string | null): string[] => jsx(cls, version).map((f) => f.message)

describe('decoration and own-direction elements', () => {
  const quiet = (markup: string): void => expect(run(`export const A = () => ${markup}`), markup).toEqual([])
  const html = (markup: string) => run(`<body>${markup}</body>`, 'a.html')

  it('is silent on aria-hidden decoration, its children, inert overlays, own dir and inline left', () => {
    quiet('<div aria-hidden="true" className="absolute left-4" />')
    quiet('<div aria-hidden="true"><span className="absolute left-4" /></div>')
    quiet('<div className="pointer-events-none absolute left-0" />')
    quiet('<p dir="rtl" className="ml-2" />')
    quiet('<p style={{ left: x }} className="absolute left-4" />')
  })

  it('is silent on the same cases in HTML', () => {
    for (const m of ['<div aria-hidden="true" class="absolute left-4"></div>', '<div aria-hidden="true"><i class="absolute left-4"></i></div>', '<div class="pointer-events-none absolute left-0"></div>', '<p dir="rtl" class="ml-2"></p>', '<p style="left: 4px" class="absolute left-4"></p>'])
      expect(html(m), m).toEqual([])
  })

  it('still fires on a button with Arabic siblings', () => {
    expect(run('export const A = () => <div><span>مرحبا</span><button className="ml-2">حفظ</button></div>')).toHaveLength(1)
    expect(html('<div><span>مرحبا</span><button class="ml-2">حفظ</button></div>')).toHaveLength(1)
  })
})

describe('registration', () => {
  it('is a note with no em dashes', () => {
    expect(rules).toHaveLength(1)
    const [r] = rules
    expect(r!.severity).toBe('note')
    expect(`${r!.title}${r!.why}${r!.fix}`).not.toContain('—')
  })

  it('builds TAILWIND_MAP from the verified rows only', () => {
    const since = new Set(TAILWIND_MAP.map((e) => e.since))
    expect([...since].sort()).toEqual(['3.1.0', '3.3.0', '3.4.0', '4.2.0'])
    const at = (cls: string) => TAILWIND_MAP.filter((e) => e.pattern.test(cls)).map((e) => [e.replace(cls), e.since])
    expect(at('ml-2')).toEqual([['ms-2', '3.3.0']])
    expect(at('left-0')).toEqual([['start-0', '3.3.0'], ['inset-s-0', '4.2.0']])
    expect(at('text-right')).toEqual([['text-end', '3.1.0']])
    expect(at('clear-left')).toEqual([['clear-start', '3.4.0']])
    expect(at('rounded-bl-md')).toEqual([['rounded-es-md', '3.3.0']])
    for (const cls of ['space-x-2', 'divide-x', 'mx-2', 'inset-x-0', 'text-center', 'top-0']) expect(at(cls), cls).toEqual([])
  })
})

describe('fires at 3.4.0', () => {
  const cases: [string, string][] = [
    ['ml-2', 'ms-2'], ['mr-auto', 'me-auto'], ['-ml-2', '-ms-2'], ['!pl-4', '!ps-4'], ['pl-4!', 'ps-4!'],
    ['md:hover:pr-2', 'md:hover:pe-2'], ['ml-[3px]', 'ms-[3px]'], ['ml-(--gap)', 'ms-(--gap)'], ['pl-0.5', 'ps-0.5'], ['right-full', 'end-full'], ['left-0', 'start-0'], ['-left-1/2', '-start-1/2'],
    ['text-left', 'text-start'], ['rounded-l-lg', 'rounded-s-lg'], ['rounded-tr', 'rounded-se'], ['rounded-l', 'rounded-s'],
    ['border-l-2', 'border-s-2'], ['border-r', 'border-e'], ['float-left', 'float-start'], ['clear-right', 'clear-end'],
    ['scroll-ml-4', 'scroll-ms-4'], ['scroll-pr-2', 'scroll-pe-2'], ['dark:md:!-mr-px', 'dark:md:!-me-px'],
  ]
  for (const [cls, fix] of cases) {
    it(`${cls} names ${fix}`, () => {
      const msgs = fired(cls)
      expect(msgs).toHaveLength(1)
      expect(msgs[0]).toContain(`\`${cls}\``)
      expect(msgs[0]).toContain(`\`${fix}\``)
    })
  }

  it('reports the class position', () => {
    const [f] = jsx('flex ml-2')
    expect(f!.line).toBe(1)
    expect(f!.column).toBe('export const A = () => <div className="flex '.length + 1)
  })
})

describe('fix text when only a range is known', () => {
  const withRange = (cls: string, range: string, version: string) =>
    lintText('a.tsx', `export const A = () => <div className="${cls}" />`, { rules, ctx: { tailwindVersion: () => version, tailwindRange: () => range } }).map((f) => f.message)
  it('names both start-* and inset-s-* when the range spans 4.2', () => {
    expect(withRange('left-0', '^4', '4.0.0')[0]).toContain('`start-0` (or `inset-s-0` from Tailwind 4.2)')
    expect(withRange('right-4', '^4.0.0', '4.0.0')[0]).toContain('`end-4` (or `inset-e-4` from Tailwind 4.2)')
  })
  it('names one class when the range sits on one side of 4.2', () => {
    expect(withRange('left-0', '~4.1.0', '4.1.0')[0]).not.toContain('inset-s-0')
    expect(withRange('left-0', '^4.2.0', '4.2.0')[0]).not.toContain('`start-0`')
    expect(withRange('ml-2', '^4', '4.0.0')[0]).not.toContain('(or')
  })
})

describe('fix text follows the installed version', () => {
  it('names start-* below 4.2 and inset-s-* from 4.2', () => {
    expect(fired('left-0', '4.1.9')[0]).toContain('`start-0`')
    expect(fired('right-4', '4.2.0')[0]).toContain('`inset-e-4`')
    expect(fired('right-4', '4.2.0')[0]).not.toContain('`end-4`')
  })

  it('does not name a class the installed version lacks', () => {
    const [msg] = fired('float-left', '3.3.5')
    expect(msg).toBeDefined()
    expect(msg).not.toContain('float-start')
    expect(msg).toContain('3.4')
    expect(fired('ml-2', '3.3.0')[0]).toContain('`ms-2`')
  })
})

describe('quiet', () => {
  const quiet = [
    'rtl:ml-2', 'ltr:md:pr-4', 'md:rtl:ml-2', 'group-[dir=rtl]:pl-2', '[dir=rtl]_&:pl-2', '[&:dir(rtl)]:mr-2',
    'mx-2', 'px-4', 'inset-x-0', 'scroll-mx-2', 'scroll-px-2', 'border-x', 'border-x-2',
    'left-0 right-0', 'ml-2 mr-2', 'md:pl-4 md:pr-4', 'rounded-tl-md rounded-tr-md',
    'left-1/2 -translate-x-1/2', 'right-1/2 translate-x-1/2', 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
    'ms-2', 'me-auto', 'ps-4', 'start-0', 'inset-s-0', 'text-start', 'rounded-s-lg', 'border-s', 'float-start',
    'space-x-2', 'divide-x', 'text-center', 'top-0', 'translate-x-2', '[margin-left:3px]', 'left', 'ml-',
    'left-panel', 'right-sidebar', 'pl-container', 'mr-gutter',
  ]
  for (const cls of quiet) it(cls, () => expect(fired(cls)).toEqual([]))

  it('stays quiet below 3.3 and with no version', () => {
    expect(fired('ml-2', '3.2.7')).toEqual([])
    expect(fired('text-left', '3.1.0')).toEqual([])
    expect(fired('ml-2', null)).toEqual([])
    expect(lintText('a.tsx', '<a className="ml-2" />', { rules })).toEqual([])
  })

  it('does not fire when the pair is split across class strings with different values', () => {
    expect(fired('ml-2 mr-4')).toHaveLength(2)
    expect(fired('left-1/2')).toHaveLength(1)
  })

  it('ignores non-class strings, comments and the safelist', () => {
    expect(run("const label = 'ml-2'\n// <div className=\"ml-2\" />\n/* pl-4 */\nfoo('pr-2')")).toEqual([])
    expect(run("module.exports = { content: ['./src/**/*.tsx'], safelist: ['ml-2', 'pr-4', 'text-left'] }", 'tailwind.config.js')).toEqual([])
    expect(run('`ml-${n}`; cn(`ml-${n}`)')).toEqual([])
  })

  it('a dynamic suffix does not make a class', () => {
    expect(run('export const A = ({ n }) => <a className={`ml-${n} pr-${m}`} />')).toEqual([])
  })
})

describe('real shapes', () => {
  it('shadcn cn with ml-auto and a passed className', () => {
    const src = `import { cn } from "@/lib/utils"
export function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
}`
    expect(run(src).map((f) => f.message)).toEqual([expect.stringContaining('`ms-auto`')])
  })

  it('shadcn cva button with variants', () => {
    const src = `import { cva } from "class-variance-authority"
const buttonVariants = cva("inline-flex items-center gap-2", {
  variants: {
    variant: { default: "bg-primary", link: "underline-offset-4 pl-0" },
    size: { default: "h-9 px-4 py-2", icon: "size-9" },
  },
  defaultVariants: { variant: "default", size: "default" },
})`
    expect(run(src).map((f) => f.message)).toEqual([expect.stringContaining('`ps-0`')])
  })

  it('Next.js layout with a font variable in a template', () => {
    const src = 'export default function RootLayout({ children }) {\n  return <html lang="en"><body className={`${inter.variable} ml-4 antialiased`}>{children}</body></html>\n}'
    expect(run(src).map((f) => f.message)).toEqual([expect.stringContaining('`ms-4`')])
  })

  it('a TSX generic arrow and clsx object keys', () => {
    const src = 'const id = <T,>(x: T) => x\nexport const A = ({ active }) => <a className={clsx({ "pl-4": active, "font-bold": true })} />'
    expect(run(src).map((f) => f.message)).toEqual([expect.stringContaining('`ps-4`')])
  })

  it('an HTML file with classes on many elements', () => {
    const src = '<!doctype html><html><body class="m-0"><nav class="flex px-4"><a class="mr-2">a</a><a class="ml-auto rtl:mr-auto">b</a></nav><p class="text-left">x</p></body></html>'
    expect(run(src, 'index.html').map((f) => f.message)).toEqual([
      expect.stringContaining('`me-2`'), expect.stringContaining('`ms-auto`'), expect.stringContaining('`text-start`'),
    ])
  })

  it('@apply in SCSS skips the rtl variant', () => {
    const msgs = run('.btn { @apply ml-2 rtl:mr-2; }', 'a.scss').map((f) => f.message)
    expect(msgs).toEqual([expect.stringContaining('`ms-2`')])
    expect(run('.btn { @apply ml-2 rtl:ml-0 rtl:mr-2; }', 'a.scss')).toEqual([])
  })
})

describe('lint wires the installed version', () => {
  it('reads tailwind from package.json under cwd', async () => {
    const root = tree({
      'package.json': JSON.stringify({ devDependencies: { tailwindcss: '^3.4.1' } }),
      'src/a.tsx': 'export const A = () => <div className="ml-2" />',
      'old/package.json': JSON.stringify({ devDependencies: { tailwindcss: '3.2.0' } }),
      'old/b.tsx': 'export const B = () => <div className="ml-2" />',
    })
    const result = await lint(['.'], { cwd: root, rules })
    expect(result.findings.map((f) => f.file)).toEqual(['src/a.tsx'])
  })
})

describe('fix round 1', () => {
  it('shadcn Dialog: the centred content is quiet, the close button and header alignment fire', () => {
    const src = readFileSync(new URL('../fixtures/shadcn-dialog.tsx.txt', import.meta.url), 'utf8')
    expect(run(src).map((f) => f.message.split('`')[1])).toEqual(['right-4', 'sm:text-left'])
  })

  const centred = [
    'left-1/2 -translate-x-1/2', 'left-1/2 translate-x-[-50%]', 'left-[50%] -translate-x-[50%]', 'left-[50%] translate-x-[-50%]',
    'right-1/2 translate-x-1/2', 'right-[50%] translate-x-[50%]', 'right-1/2 -translate-x-1/2', 'right-[50%] translate-x-[-50%]',
  ]
  for (const cls of centred) it(`centring: ${cls}`, () => expect(fired(cls)).toEqual([]))

  it('pairs and centring are judged per class source, not per string', () => {
    const quietSrc = [
      'cn("absolute left-1/2 top-0", "-translate-x-1/2")', "cn('ml-2', 'mr-2')",
      'export const A = () => <a className={cn("left-0", ["right-0"])} />',
    ]
    // Round 2: a conditional half never pairs, so these fire.
    expect(run("cn('pl-4', on && 'pr-4')")).toHaveLength(2)
    expect(run('export const A = () => <a className={on ? "left-0" : "right-0"} />')).toHaveLength(2)
    expect(run("cva('ml-2', { variants: { a: { b: 'mr-2' } } })")).toHaveLength(2)
    for (const src of quietSrc) expect(run(src), src).toEqual([])
    expect(run("cn('ml-2'); cn('mr-2')")).toHaveLength(2)
    expect(run('export const A = () => <><a className="ml-2" /><b className="mr-2" /></>')).toHaveLength(2)
    expect(run('<p class="ml-2"></p><p class="mr-2"></p>', 'a.html')).toHaveLength(2)
    expect(run('.a { @apply ml-2; } .b { @apply mr-2; }', 'a.css')).toHaveLength(2)
  })

  it('skips a class under a variant naming left or right, which is physical on purpose', () => {
    for (const cls of ['data-[side=left]:mr-2', 'group-data-[side=right]:border-l', 'data-[side=right]:slide-in-from-left-2 data-[side=left]:pr-2']) expect(fired(cls), cls).toEqual([])
    expect(fired('data-[state=open]:ml-2')).toHaveLength(1)
    expect(fired('leftish:ml-2')).toHaveLength(1)
  })

  it('skips offscreen offsets of 999 or more', () => {
    for (const cls of ['-left-[9999px]', 'right-[-9999px]', '-right-[999px]', 'left-[-10000em]']) expect(fired(cls), cls).toEqual([])
    for (const cls of ['-left-[998px]', 'left-[9999px]', '-left-4']) expect(fired(cls), cls).toHaveLength(1)
  })
})

describe('fix round 2: only unconditional classes pair', () => {
  const shown = (src: string) => run(src).map((f) => f.message.split('`')[1])
  it('conditional halves of a pair both fire', () => {
    expect(shown("cn('px-2', first && 'rounded-l', last && 'rounded-r')")).toEqual(['rounded-l', 'rounded-r'])
    expect(shown("cn('ml-2', open && 'mr-2')")).toEqual(['ml-2', 'mr-2'])
    expect(shown("cn(a ? 'left-0' : 'right-0')")).toEqual(['left-0', 'right-0'])
    expect(shown("clsx({ 'pl-2': a, 'pr-2': b })")).toEqual(['pl-2', 'pr-2'])
    expect(shown("cva('', { variants: { s: { a: 'ml-2', b: 'mr-2' } } })")).toEqual(['ml-2', 'mr-2'])
    expect(shown("cn('left-1/2', open && '-translate-x-1/2')")).toEqual(['left-1/2'])
  })
  it('a pair in one string or across unconditional arguments stays quiet', () => {
    for (const src of ["cn('absolute left-1/2', '-translate-x-1/2')", "cn('ml-2', 'mr-2')", "cn(open && 'ml-2 mr-2')", "clsx({ 'left-0 right-0': a })"]) expect(shown(src), src).toEqual([])
  })
})

describe('an explicit rtl: or ltr: override of the same property', () => {
  it('stays quiet when the source resets the same side under rtl:', () => {
    expect(fired('ml-4 rtl:ml-0 rtl:mr-4')).toEqual([])
    expect(fired('left-0 rtl:left-auto rtl:right-0')).toEqual([])
    expect(fired('rounded-l-lg ltr:rounded-l-none')).toEqual([])
    expect(fired('text-left rtl:text-right')).toEqual([])
    expect(fired('float-left rtl:float-right')).toEqual([])
    expect(run("const c = cn('pl-2', on && 'rtl:pl-0 rtl:pr-2')", 'a.ts')).toEqual([])
  })

  it('still fires when the override sets the other side or another property', () => {
    expect(fired('ml-2 rtl:mr-2')).toHaveLength(1)
    expect(fired('rounded-l-lg ltr:rounded-r-none')).toHaveLength(1)
    expect(fired('rounded-tl-lg rtl:rounded-l-none')).toHaveLength(1)
    expect(fired('ml-4 rtl:text-right')).toHaveLength(1)
    expect(fired('pl-4 rtl:ml-2')).toHaveLength(1)
    expect(fired('float-left rtl:clear-left')).toHaveLength(1)
  })
})

describe('a side chosen by a left or right test', () => {
  it('skips both arms of a ternary that compares with left or right (noli-ae console-frame shape)', () => {
    const code = `export const A = ({ side }) => <div className={cn('absolute', side === 'left' ? 'left-0' : 'right-0 -scale-x-100')} />`
    expect(run(code)).toEqual([])
    expect(run(`const c = 'right' !== side ? 'pl-2' : 'pr-2'`.replace('const c = ', "const c = cn(") + ')', 'a.ts')).toEqual([])
  })

  it('still fires on a ternary with another test', () => {
    expect(run("const c = cn(open ? 'left-0' : 'right-0')", 'a.ts')).toHaveLength(2)
    expect(run("const c = cn(side === 'top' ? 'ml-2' : 'mt-2')", 'a.ts')).toHaveLength(1)
  })

  it('skips cva and tv variant values under a left or right key', () => {
    const code = "const v = cva('p-2', { variants: { side: { left: 'left-0 rounded-r-lg', right: 'right-0 rounded-l-lg', top: 'ml-2' } } })"
    const hits = run(code, 'a.ts')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain('ml-2')
    expect(run("const v = tv({ variants: { side: { left: { base: 'pl-4' } } } })", 'a.ts')).toEqual([])
  })
})

describe('lint names both inset names for a range with nothing installed', () => {
  it('reads ^4 from package.json', async () => {
    const root = tree({ 'package.json': JSON.stringify({ devDependencies: { tailwindcss: '^4' } }), 'a.tsx': 'export const A = () => <div className="left-0" />' })
    const { findings } = await lint(['.'], { cwd: root, rules })
    expect(findings[0]!.message).toContain('`start-0` (or `inset-s-0` from Tailwind 4.2)')
  })
})
