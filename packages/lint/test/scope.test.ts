import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFlipperLookup, quietReason } from '../src/scope'
import { tree } from './helpers'

describe('quietReason', () => {
  it('spots generated files in the first 5 lines only', () => {
    expect(quietReason('a/b.css', '/*! tailwindcss v3.4.1 | MIT */\n.a{}')).toBe('generated')
    expect(quietReason('a.ts', '// @generated\nx')).toBe('generated')
    expect(quietReason('a.css', '/* DO NOT EDIT */\n.a{}')).toBe('generated')
    expect(quietReason('a.css', '\n\n\n\n/* DO NOT EDIT */\n')).toBe('generated')
    expect(quietReason('a.css', '\n\n\n\n\n/* DO NOT EDIT */\n')).toBeNull()
  })

  it('does not treat lowercase prose as generated', () => {
    expect(quietReason('a.css', '/* do not edit below this line by hand */\n.a{}')).toBeNull()
  })

  it('matches example directories by whole segment', () => {
    for (const p of ['examples/x.css', 'packages/demo/a.tsx', 'src/__fixtures__/a.css', 'stories/a.tsx', 'storybook-static/a.css']) {
      expect(quietReason(p, '')).toBe('example')
    }
    expect(quietReason('src/exampleCard.tsx', '')).toBeNull()
  })

  it('matches email directories by whole segment', () => {
    for (const p of ['app/views/mailer/a.scss', 'emails/welcome.html', 'lib/mail/x.css']) expect(quietReason(p, '')).toBe('email')
    expect(quietReason('src/mailbox/a.css', '')).toBeNull()
  })
})

describe('createFlipperLookup', () => {
  const pkg = (deps: Record<string, string>) => JSON.stringify({ devDependencies: deps })

  it('finds a flipper in the top package.json and in any ancestor', () => {
    const top = tree({ 'package.json': pkg({ rtlcss: '^4' }), 'pkg/package.json': pkg({}), 'app/a.scss': '' })
    const find = createFlipperLookup(top)
    expect(find(join(top, 'app/a.scss'))).toBe('rtlcss')
    expect(find(join(top, 'pkg/deep/a.scss'))).toBe('rtlcss')
  })

  it('reads a Gemfile at top', () => {
    const top = tree({ Gemfile: 'source "x"\ngem "rtlcss"\n', 'app/a.scss': '' })
    expect(createFlipperLookup(top)(join(top, 'app/a.scss'))).toBe('rtlcss')
  })

  it('ignores a commented-out gem line', () => {
    const top = tree({ Gemfile: '# gem "rtlcss"\n  # gem "rtlcss"\n' })
    expect(createFlipperLookup(top)(join(top, 'a.scss'))).toBeNull()
  })

  it.each(['postcss-rtlcss', 'postcss-rtl', 'cssjanus', 'stylis-plugin-rtl', '@mui/stylis-plugin-rtl'])('finds %s', (name) => {
    const top = tree({ 'package.json': pkg({ [name]: '1' }) })
    expect(createFlipperLookup(top)(join(top, 'a.css'))).toBe(name)
  })

  it('gives null when none is declared', () => {
    const top = tree({ 'package.json': pkg({ react: '1' }) })
    expect(createFlipperLookup(top)(join(top, 'a.css'))).toBeNull()
  })

  it('never reads a package.json above top', () => {
    const outer = tree({ 'package.json': pkg({ rtlcss: '1' }), 'top/a.css': '' })
    expect(createFlipperLookup(join(outer, 'top'))(join(outer, 'top/a.css'))).toBeNull()
    expect(createFlipperLookup(join(outer, 'top'))(join(outer, 'a.css'))).toBeNull()
  })

  it('handles a top with no files', () => {
    const top = mkdtempSync(join(tmpdir(), 'dualkit-scope-'))
    expect(createFlipperLookup(top)(join(top, 'a.css'))).toBeNull()
  })
})
