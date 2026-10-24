import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { cssEdits } from '../src/transforms/css'

function run(text: string, path = 'src/a.css') {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(outcome.error)
  const result = cssEdits(outcome.file)
  return { ...result, out: applyEdits(text, result.edits) }
}

describe('cssEdits', () => {
  it('renames a physical property and keeps the formatting', () => {
    expect(run('.a {\n  margin-left:8px;\n}\n').out).toBe('.a {\n  margin-inline-start:8px;\n}\n')
  })

  it('converts every physical property in PHYSICAL_PROPS', () => {
    const { out } = run('.a { left: 4px; border-top-left-radius: 2px; border-right-color: red; padding-right: 1px }')
    expect(out).toBe('.a { inset-inline-start: 4px; border-start-start-radius: 2px; border-inline-end-color: red; padding-inline-end: 1px }')
  })

  it('converts text-align, float and clear keywords', () => {
    const { out } = run('.a { text-align: right; float: left; clear: right }')
    expect(out).toBe('.a { text-align: end; float: inline-start; clear: inline-end }')
  })

  it('splits a 4-value margin whose sides differ', () => {
    expect(run('.a { margin: 0 8px 0 16px; }').out).toBe('.a { margin-block: 0 0; margin-inline: 16px 8px; }')
    expect(run('.a { padding: 1px 2px 3px 4px !important }').out).toBe('.a { padding-block: 1px 3px !important; padding-inline: 4px 2px !important }')
  })

  it('leaves a symmetric margin alone', () => {
    const r = run('.a { margin: 0 8px; padding: 1px 2px 3px 2px }')
    expect(r.edits).toEqual([])
  })

  it('leaves left and right set together alone', () => {
    expect(run('.a { left: 0; right: 0 }').edits).toEqual([])
  })

  it('leaves off-screen and centring patterns alone', () => {
    expect(run('.a { position: absolute; left: -9999px }').edits).toEqual([])
    expect(run('.a { left: 50%; transform: translateX(-50%) }').edits).toEqual([])
  })

  it('leaves rules under [dir] and :dir() alone', () => {
    expect(run('[dir="rtl"] .a { margin-left: 4px }').edits).toEqual([])
    expect(run('.a:dir(rtl) { margin-left: 4px; margin: 0 1px 0 2px }').edits).toEqual([])
  })

  it('leaves a block a build-time flipper mirrors alone', () => {
    const outcome = parseSourceOutcome('src/a.css', '.a { margin-left: 4px }')
    if (!('file' in outcome)) throw new Error(outcome.error)
    expect(cssEdits(outcome.file, { blockFlipper: () => 'rtlcss' }).edits).toEqual([])
  })

  it('converts SCSS, inline style blocks and template CSS', () => {
    expect(run('.a { .b { margin-left: 1px } }', 'src/a.scss').out).toBe('.a { .b { margin-inline-start: 1px } }')
    const html = '<style>.a { text-align: left }</style><p class="a">x</p>'
    expect(run(html, 'index.html').out).toBe('<style>.a { text-align: start }</style><p class="a">x</p>')
    const tsx = 'const B = styled.div`\n  padding-left: ${(p) => p.x}px;\n  float: right;\n`\n'
    expect(run(tsx, 'src/b.tsx').out).toBe('const B = styled.div`\n  padding-inline-start: ${(p) => p.x}px;\n  float: inline-end;\n`\n')
  })

  it('converts JSX style objects', () => {
    const jsx = (s: string): string => `export const A = () => <div style={{ ${s} }} />\n`
    expect(run(jsx("marginLeft: 4, textAlign: 'right'"), 'src/a.tsx').out).toBe(jsx("marginInlineStart: 4, textAlign: 'end'"))
    expect(run(jsx('left: 0, top: 2'), 'src/a.tsx').out).toBe(jsx('insetInlineStart: 0, top: 2'))
    expect(run(jsx("float: 'left'"), 'src/a.tsx').out).toBe(jsx("float: 'inline-start'"))
    expect(run(jsx('marginLeft: 4, marginRight: 4'), 'src/a.tsx').edits).toEqual([])
    expect(run(jsx("margin: '0 8px 0 16px'"), 'src/a.tsx').out).toBe(jsx("marginBlock: '0 0', marginInline: '16px 8px'"))
  })

  it('flags properties with no logical form and leaves them unchanged', () => {
    const css = [
      '.a { transform: translateX(4px) }',
      '.b { background-position: left 4px top }',
      '.c { box-shadow: 2px 2px 4px #000 }',
      '.d { border-width: 1px 2px 3px 4px }',
      '.e { border-radius: 1px 2px 3px 4px }',
    ].join('\n')
    const r = run(css)
    expect(r.edits).toEqual([])
    expect(r.flags.map((f) => [f.line, f.kind])).toEqual([[1, 'no-logical-form'], [2, 'no-logical-form'], [3, 'no-logical-form'], [4, 'no-logical-form'], [5, 'no-logical-form']])
  })

  it('does not flag zero offsets, centring or symmetric sides', () => {
    const css = '.a { transform: translateX(0) }\n.b { box-shadow: 0 2px 4px #000 }\n.c { border-width: 1px 2px }\n.d { border-radius: 4px }\n.e { left: 50%; transform: translate(-50%, 0) }'
    expect(run(css).flags).toEqual([])
  })

  it('flags translateX in a JSX style object', () => {
    const r = run("export const A = () => <div style={{ transform: 'translateX(4px)' }} />\n", 'src/a.tsx')
    expect(r.flags.map((f) => f.kind)).toEqual(['no-logical-form'])
  })

  it('gives zero edits when run again on its own output', () => {
    const text = '.a { margin-left: 8px; margin: 0 8px 0 16px; text-align: left; float: right }\n'
    const first = run(text)
    expect(first.edits.length).toBeGreaterThan(0)
    expect(run(first.out).edits).toEqual([])
    const jsx = "export const A = () => <div style={{ marginLeft: 4, textAlign: 'right' }} />\n"
    expect(run(run(jsx, 'src/a.tsx').out, 'src/a.tsx').edits).toEqual([])
  })
})
