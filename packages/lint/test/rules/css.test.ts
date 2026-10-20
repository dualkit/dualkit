import { describe, expect, it } from 'vitest'
import scss from 'postcss-scss'
import { RULES } from '../../src/rules'
import { lintText } from '../../src/run'
import { directionScoped, fullSelectors, targetsArabic } from '../../src/selectors'
import type { Rule } from 'postcss'

const IDS = ['source/physical-css', 'source/arabic-letter-spacing', 'source/dir-attribute-selector']
const run = (path: string, text: string, id: string) => lintText(path, text, { rules: RULES.filter((r) => r.id === id) })
const physical = (text: string, path = 'a.css') => run(path, text, 'source/physical-css')
const spacing = (text: string, path = 'a.css') => run(path, text, 'source/arabic-letter-spacing')
const dirAttr = (text: string, path = 'a.css') => run(path, text, 'source/dir-attribute-selector')

describe('registration', () => {
  it('registers the three rules with the right severities and no em dashes', () => {
    const mine = RULES.filter((r) => IDS.includes(r.id))
    expect(mine.map((r) => [r.id, r.severity])).toEqual([
      ['source/physical-css', 'warning'], ['source/arabic-letter-spacing', 'error'], ['source/dir-attribute-selector', 'note'],
    ])
    for (const r of mine) expect(`${r.title}${r.why}${r.fix}`).not.toContain('—')
  })
})

describe('selectors', () => {
  const rules = (css: string): Rule[] => { const out: Rule[] = []; scss.parse(css).walkRules((r) => { out.push(r) }); return out }
  it('resolves & against ancestors', () => {
    const inner = rules('.a, .b { [dir=rtl] & { x: y } &-c { x: y } .d { x: y } }')
    expect(fullSelectors(inner[1]!)).toEqual(['[dir=rtl] .a', '[dir=rtl] .b'])
    expect(fullSelectors(inner[2]!)).toEqual(['.a-c', '.b-c'])
    expect(fullSelectors(inner[3]!)).toEqual(['.a .d', '.b .d'])
  })
  it('directionScoped', () => {
    for (const s of ['[dir=rtl] a', '[dir="rtl"] a', "[dir='rtl'] a", 'a:dir(rtl)', ':lang(ar) a', ':lang("ar-AE") a', '[ dir = rtl ]']) expect(directionScoped(s), s).toBe(true)
    for (const s of ['.a', '[data-dir=rtl] a', ':lang(en)', '.dir']) expect(directionScoped(s), s).toBe(false)
  })
  it('targetsArabic', () => {
    for (const s of [':lang(ar)', ':lang(ar-SA) p', '[lang="ar"]', '[lang|="ar"]', '[lang^=ar]', ':dir(rtl)', '[dir="rtl"] h1', "[dir='rtl']", '[dir=rtl]']) expect(targetsArabic(s), s).toBe(true)
    for (const s of ['.a', ':lang(en)', ':dir(ltr)', '[dir=ltr]', '[data-dir=rtl]', ':not(:lang(ar))', '[lang="art"]']) expect(targetsArabic(s), s).toBe(false)
  })
})

describe('source/physical-css', () => {
  const cases: [string, string][] = [
    ['margin-left: 1px', 'margin-inline-start'], ['padding-right: 1px', 'padding-inline-end'], ['left: 1px', 'inset-inline-start'],
    ['right: 1px', 'inset-inline-end'], ['border-left: 1px solid red', 'border-inline-start'], ['border-right-width: 2px', 'border-inline-end-width'],
    ['border-left-color: red', 'border-inline-start-color'], ['border-right-style: solid', 'border-inline-end-style'],
    ['margin-right: 3px', 'margin-inline-end'], ['padding-left: 3px', 'padding-inline-start'],
    ['border-top-left-radius: 4px', 'border-start-start-radius'], ['border-top-right-radius: 4px', 'border-start-end-radius'],
    ['border-bottom-left-radius: 4px', 'border-end-start-radius'], ['border-bottom-right-radius: 4px', 'border-end-end-radius'],
    ['float: left', 'float: inline-start'], ['float: right', 'float: inline-end'], ['text-align: left', 'text-align: start'],
    ['text-align: right', 'text-align: end'], ['clear: left', 'clear: inline-start'], ['MARGIN-LEFT: 1px', 'margin-inline-start'],
    ['float: LEFT !important', 'float: inline-start'],
  ]
  for (const [decl, logical] of cases) {
    for (const path of ['a.css', 'a.scss']) {
      it(`fires on ${decl} in ${path}`, () => {
        const f = physical(`.a { ${decl} }`, path)
        expect(f).toHaveLength(1)
        expect(f[0]!.message).toContain(logical)
        expect(f[0]).toMatchObject({ severity: 'warning', line: 1, column: 6 })
      })
    }
  }

  it('fires on both sides of an asymmetric pair', () => {
    expect(physical('.a { left: 0; right: 4px }')).toHaveLength(2)
  })
  it('does not fire on a symmetric pair', () => {
    for (const body of ['left: 0; right: 0', 'margin-left: auto; margin-right: auto', 'padding-left: 1rem; padding-right: 1rem',
      'border-left: 1px solid; border-right: 1px solid', 'right:  0 ; left:0', 'margin-left: 1PX; margin-right: 1px !important',
      'border-top-left-radius: 4px; border-top-right-radius: 4px']) {
      expect(physical(`.a { ${body} }`), body).toEqual([])
    }
  })
  it('treats a zero with any unit as the same zero', () => {
    for (const body of ['left: 0; right: 0px', 'left: 0em; right: 0', 'left: 0; right: 0%', 'margin-left: 0.0rem; margin-right: -0', 'left: 0; right: 0px !important']) {
      expect(physical(`.a { ${body} }`), body).toEqual([])
    }
    expect(physical('.a { left: 0; right: 10px }')).toHaveLength(2)
    expect(physical('.a { left: 0; right: 0.5px }')).toHaveLength(2)
  })
  it('exempts the centring idiom only with an x translate of 50%', () => {
    expect(physical('.a { left: 50% }')).toHaveLength(1)
    expect(physical('.a { left: 50%; transform: rotate(5deg) }')).toHaveLength(1)
    expect(physical('.a { left: 50%; transform: translateY(-50%) }')).toHaveLength(1)
    for (const t of ['transform: translateX(-50%)', 'transform: translate(-50%, -50%)', 'transform: translate3d(-50%, 0, 0)', 'translate: -50% -50%']) {
      expect(physical(`.a { left: 50%; ${t} }`), t).toEqual([])
      expect(physical(`.a { ${t}; right: 50% }`), t).toEqual([])
    }
    expect(physical('.a { left: 40%; transform: translateX(-50%) }')).toHaveLength(1)
  })
  it('treats a :not([dir=rtl]) selector as a deliberate direction scope', () => {
    expect(physical('body:not([dir=rtl]) .a { left: 1px }')).toEqual([])
  })
  it('stays quiet on correct code', () => {
    for (const body of ['text-align: center', 'text-align: start', 'margin-inline-start: 1px', 'float: inline-start', 'inset-inline-start: 0',
      'margin: 0 auto', 'inset: 0', 'padding: 0 1rem', '--left: 1px', '-webkit-margin-left: 1px', 'border-start-start-radius: 4px']) {
      expect(physical(`.a { ${body} }`), body).toEqual([])
    }
  })
  it('stays quiet under direction-scoped selectors', () => {
    for (const css of ['[dir="rtl"] .a { margin-left: 0 }', '[dir=rtl] .a { margin-left: 0 }', "[dir='rtl'] .a { left: 0 }", '.a:dir(rtl) { left: 0 }',
      ':lang(ar) .a { text-align: left }', '.a:lang(ar-AE) { float: left }']) {
      expect(physical(css), css).toEqual([])
    }
  })
  it('stays quiet under direction-scoped SCSS ancestors and fires elsewhere', () => {
    expect(physical('.a { [dir=rtl] & { margin-left: 0 } }', 'a.scss')).toEqual([])
    expect(physical('[dir=rtl] { .a { .b { margin-left: 0 } } }', 'a.scss')).toEqual([])
    expect(physical('.a { &:dir(rtl) { left: 0 } }', 'a.scss')).toEqual([])
    expect(physical('.a { @media (min-width: 1px) { [dir=rtl] & { left: 0 } } }', 'a.scss')).toEqual([])
    expect(physical('.a { .b { left: 1px } }', 'a.scss')).toHaveLength(1)
  })
  it('treats each selector of a list separately', () => {
    expect(physical('a, [dir=rtl] b { left: 1px }')).toHaveLength(1)
    expect(physical('[dir=rtl] a, :dir(rtl) b { left: 1px }')).toEqual([])
  })
  it('never guesses interpolated names, comments or variables', () => {
    expect(physical('.a { #{$side}: 0; margin-#{$side}: 1px }', 'a.scss')).toEqual([])
    expect(physical('.a { /* margin-left: 1px */ }')).toEqual([])
    expect(physical('.a { $left: 1px; }', 'a.scss')).toEqual([])
  })
  it('checks inside @media and @supports', () => {
    expect(physical('@media (min-width: 1px) { .a { left: 1px } }')).toHaveLength(1)
    expect(physical('@supports (display: grid) { .a { float: left } }')).toHaveLength(1)
  })
  it('fires at the right line inside inline <style>', () => {
    const f = physical('<!doctype html>\n<html><head>\n<style>\n.a {\n  margin-left: 1px;\n}\n</style></head></html>\n', 'a.html')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ line: 5, column: 3 })
  })
  it('handles a Tailwind generated file', () => {
    const css = '@tailwind base;\n@layer components {\n  .btn { @apply px-4 py-2; text-align: center; }\n}\n.ml-4 { margin-left: 1rem; }\n'
    const f = physical(css)
    expect(f).toHaveLength(1)
    expect(f[0]!.line).toBe(5)
  })
  it('fires on text-align: left inside a reset th', () => {
    expect(physical('th { text-align: left; font-weight: 600 }')).toHaveLength(1)
  })
  it('exempts huge negative offscreen offsets', () => {
    expect(physical('.sr-only { position: absolute; left: -9999px }')).toEqual([])
    expect(physical('.sr-only { position: absolute; left: -999px; right: auto }')).toHaveLength(1)
    expect(physical('.x { left: -100px }')).toHaveLength(1)
    expect(physical('.x { right: -10000px }')).toEqual([])
  })
})

describe('source/arabic-letter-spacing', () => {
  it('fires on Arabic selectors with non-zero spacing', () => {
    for (const [css, path] of [[':lang(ar) { letter-spacing: .05em }', 'a.css'], ['[dir="rtl"] h1 { letter-spacing: 1px }', 'a.css'],
      ['.a { [dir=rtl] & { letter-spacing: 0.1em } }', 'a.scss'], ['html[lang|="ar"] p { letter-spacing: -0.02em }', 'a.css'],
      ['.a { &:lang(ar) { .b { letter-spacing: 2px } } }', 'a.scss']] as const) {
      const f = spacing(css, path)
      expect(f, css).toHaveLength(1)
      expect(f[0]).toMatchObject({ severity: 'error' })
    }
  })
  it('stays quiet on zero values, keywords and unknowns', () => {
    for (const v of ['0', 'normal', '0px', '0em', '0rem', '0.0', '0.00em', 'initial', 'inherit', 'unset', 'var(--ls)', '$ls', 'NORMAL']) {
      expect(spacing(`:lang(ar) { letter-spacing: ${v} }`, 'a.scss'), v).toEqual([])
    }
  })
  it('stays quiet on non-Arabic selectors and word-spacing', () => {
    expect(spacing('.a { letter-spacing: .05em }')).toEqual([])
    expect(spacing(':lang(en) { letter-spacing: .05em }')).toEqual([])
    expect(spacing(':lang(ar) { word-spacing: .05em }')).toEqual([])
    expect(spacing('[dir=ltr] h1 { letter-spacing: 1px }')).toEqual([])
  })
  it('fires at the declaration in inline <style>', () => {
    const f = spacing('<style>\n:lang(ar) {\n  letter-spacing: 1px;\n}\n</style>', 'a.html')
    expect(f[0]).toMatchObject({ line: 3, column: 3 })
  })
})

describe('source/dir-attribute-selector', () => {
  it('fires on [dir] attribute selectors', () => {
    expect(dirAttr('[dir="rtl"] .x { color: red }')).toHaveLength(1)
    expect(dirAttr('[dir=ltr] { color: red }')).toHaveLength(1)
    expect(dirAttr('.a { [dir=rtl] & { color: red } }', 'a.scss')).toHaveLength(1)
    expect(dirAttr("html[dir='rtl'] .x { color: red }")[0]).toMatchObject({ severity: 'note', line: 1, column: 1 })
  })
  it('stays quiet on :dir() and other attributes', () => {
    expect(dirAttr(':dir(rtl) .x { color: red }')).toEqual([])
    expect(dirAttr('[data-dir="rtl"] .x { color: red }')).toEqual([])
    expect(dirAttr('.dir { color: red }')).toEqual([])
    expect(dirAttr('[lang="ar"] .x { color: red }')).toEqual([])
  })
  it('fires at the right line in inline <style>', () => {
    const f = dirAttr('<style>\n.a {}\n[dir=rtl] .x { color: red }\n</style>', 'a.html')
    expect(f[0]).toMatchObject({ line: 3, column: 1 })
  })
})

describe('physical-css with a direction override in the same file', () => {
  it('skips the base when a :dir(), [dir] or :lang(ar) rule for the same selector sets the same family', () => {
    expect(physical('.n { left: 0 } .n:dir(rtl) { left: auto; right: 0 }')).toEqual([])
    expect(physical('.n { left: 0 } [dir=rtl] .n { left: auto; right: 0 }')).toEqual([])
    expect(physical('.n { left: 0 } html[dir="rtl"] .n { inset-inline: auto 0 }')).toEqual([])
    expect(physical('.a .b { margin-left: 4px } :lang(ar) .a .b { margin: 0 4px 0 0 }')).toEqual([])
    expect(physical('.t { text-align: left } .t:dir(rtl) { text-align: right }')).toEqual([])
    expect(physical('.c { border-top-left-radius: 4px } .c:dir(rtl) { border-top-left-radius: 0; border-top-right-radius: 4px }')).toEqual([])
    expect(physical('.c { border-left-width: 1px } .c:dir(rtl) { border-width: 0 0 0 0 }')).toEqual([])
    expect(physical('.n { left: 0; &:dir(rtl) { left: auto; right: 0 } }', 'a.scss')).toEqual([])
  })

  it('still fires when the override is for another selector or another family', () => {
    expect(physical('.n { left: 0 } .m:dir(rtl) { left: auto }')).toHaveLength(1)
    expect(physical('.n { left: 0 } .n:dir(rtl) { margin-left: 0 }')).toHaveLength(1)
    expect(physical('.c { border-top-left-radius: 4px } .c:dir(rtl) { border-left: 0 }')).toHaveLength(1)
    expect(physical('.c { border-top-left-radius: 4px } .c:dir(rtl) { border-top-right-radius: 4px }')).toHaveLength(1)
    expect(physical('.n { margin-left: 1rem } [dir=rtl] .n { margin-right: 1rem }')).toHaveLength(1)
    expect(physical('.n { left: 0 } .n:dir(rtl) { right: 0 }')).toHaveLength(1)
    expect(physical('.n { left: 0 } .n:hover { color: red }')).toHaveLength(1)
  })
})

describe('withoutDirection', () => {
  it('removes the direction parts and keeps the rest of the selector', async () => {
    const { withoutDirection } = await import('../../src/selectors')
    expect(['[dir=rtl] .n', '.n:dir(rtl)', 'html[dir="rtl"] > .n', ':root:lang(ar) .n', '.n:dir(rtl):hover', '.n:hover:dir(rtl)'].map(withoutDirection))
      .toEqual(['.n', '.n', '.n', '.n', '.n:hover', '.n:hover'])
  })
})

describe('arabic-letter-spacing on code', () => {
  it('skips a selector whose subject is code, pre, kbd or samp', () => {
    expect(spacing(':lang(ar) code { letter-spacing: 0.02em }')).toEqual([])
    expect(spacing('[dir=rtl] .doc pre.block { letter-spacing: 1px }')).toEqual([])
    expect(spacing(':lang(ar) p > kbd, :lang(ar) samp:hover { letter-spacing: 1px }')).toEqual([])
  })
  it('still fires when code is not the subject, or another selector is Arabic text', () => {
    expect(spacing(':lang(ar) code span { letter-spacing: 1px }')).toHaveLength(1)
    expect(spacing(':lang(ar) .codex { letter-spacing: 1px }')).toHaveLength(1)
    expect(spacing(':lang(ar) code, :lang(ar) p { letter-spacing: 1px }')).toHaveLength(1)
  })
})
