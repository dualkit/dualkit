import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { tailwindEdits } from '../src/transforms/tailwind'

function run(text: string, version: string | null, path = 'src/a.tsx') {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = tailwindEdits(outcome.file, version)
  return { ...result, out: applyEdits(text, result.edits) }
}

const jsx = (classes: string, attrs = ''): string => `export const A = () => <div ${attrs} className="${classes}" />\n`

describe('tailwindEdits', () => {
  it('converts margin, padding, text align, rounded and border on 4.1', () => {
    const { out } = run(jsx('ml-4 pr-2 text-left rounded-l-lg border-r'), '4.1.0')
    expect(out).toBe(jsx('ms-4 pe-2 text-start rounded-s-lg border-e'))
  })

  it('uses start-0 on 3.4 and inset-s-0 on 4.2', () => {
    expect(run(jsx('left-0'), '3.4.0').out).toBe(jsx('start-0'))
    expect(run(jsx('left-0'), '4.2.0').out).toBe(jsx('inset-s-0'))
  })

  it('keeps variants, important and the leading minus', () => {
    expect(run(jsx('hover:!-mr-1 md:-ml-2'), '4.1.0').out).toBe(jsx('hover:!-me-1 md:-ms-2'))
  })

  it('adds rtl:space-x-reverse once on 3.4 and leaves 4.1 alone', () => {
    expect(run(jsx('flex space-x-4'), '3.4.0').out).toBe(jsx('flex space-x-4 rtl:space-x-reverse'))
    expect(run(jsx('space-x-4 md:space-x-2'), '3.4.0').out).toBe(jsx('space-x-4 rtl:space-x-reverse md:space-x-2'))
    expect(run(jsx('space-x-4'), '4.1.0').edits).toEqual([])
  })

  it('adds rtl:divide-x-reverse on 3.4', () => {
    expect(run(jsx('divide-x'), '3.4.0').out).toBe(jsx('divide-x rtl:divide-x-reverse'))
  })

  it('leaves a dir="ltr" element untouched', () => {
    expect(run(jsx('ml-4 space-x-2', 'dir="ltr"'), '3.4.0').edits).toEqual([])
  })

  it('leaves translate-x-2 unchanged and flags it', () => {
    const { edits, flags } = run(jsx('translate-x-2'), '4.1.0')
    expect(edits).toEqual([])
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ file: 'src/a.tsx', line: 1, kind: 'no-logical-form' })
    expect(flags[0]!.suggestion).not.toBe('')
  })

  it('converts classes inside cn() calls', () => {
    const src = "const c = cn('ml-2', cond && 'pl-1')\n"
    expect(run(src, '4.1.0', 'src/a.ts').out).toBe("const c = cn('ms-2', cond && 'ps-1')\n")
  })

  it('edits nothing below 3.3.0 and returns one unsupported flag', () => {
    const { edits, flags } = run(jsx('ml-4 pr-2'), '3.2.0')
    expect(edits).toEqual([])
    expect(flags).toHaveLength(1)
    expect(flags[0]).toMatchObject({ kind: 'unsupported' })
    expect(flags[0]!.message).toContain('3.3')
  })

  it('returns edits on its own output only once', () => {
    const first = run(jsx('ml-4 space-x-2 left-0'), '3.4.0')
    expect(run(first.out, '3.4.0').edits).toEqual([])
  })

  it('flags gradients, origins, backgrounds, objects, rotate, skew and offset shadows', () => {
    const classes = 'bg-gradient-to-r bg-linear-to-tl origin-left bg-right object-left-top rotate-45 -skew-x-6 shadow-[4px_4px_0_#000]'
    const { edits, flags } = run(jsx(classes), '4.1.0')
    expect(edits).toEqual([])
    expect(flags.map((f) => f.kind)).toEqual(Array(8).fill('no-logical-form'))
  })

  it('does not flag a centred translate or a zero-offset shadow', () => {
    const { flags } = run(jsx('left-1/2 -translate-x-1/2 shadow-[0_4px_8px_#000]'), '4.1.0')
    expect(flags).toEqual([])
  })

  it('flags a className template literal with an expression once', () => {
    const src = 'export const A = ({ on }) => <div className={`p-1 ${on ? "a" : "b"} ${on}`} />\n'
    const { flags } = run(src, '4.1.0')
    expect(flags.filter((f) => f.kind === 'computed-class')).toHaveLength(1)
  })

  it('reports 1-based lines', () => {
    const src = `export const A = () => (\n  <div\n    className="translate-x-2"\n  />\n)\n`
    expect(run(src, '4.1.0').flags[0]!.line).toBe(3)
  })

  it('does nothing when no Tailwind version is known', () => {
    expect(run(jsx('ml-4'), null)).toMatchObject({ edits: [], flags: [] })
  })
})
