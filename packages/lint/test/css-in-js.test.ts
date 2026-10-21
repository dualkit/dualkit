import { describe, expect, it } from 'vitest'
import { lint, lintText } from '../src/run'
import { parseSource } from '../src/parse'
import { tree } from './helpers'

const physical = (path: string, text: string) =>
  lintText(path, text).filter((f) => f.rule === 'source/physical-css').map((f) => [f.line, f.column])

describe('templateCss', () => {
  it('reads a styled template at the declaration position', () => {
    const text = 'const A = styled.div`margin-left: ${(p) => p.gap}px; color: red;`\n'
    expect(physical('a.ts', text)).toEqual([[1, text.indexOf('margin-left') + 1]])
  })

  it.each([
    'styled.div`margin-left: 1px`',
    'styled(Button)`margin-left: 1px`',
    "styled('div')`margin-left: 1px`",
    'styled.div.attrs({})`margin-left: 1px`',
    'styled(Button).attrs((p) => ({ a: 1 }))`margin-left: 1px`',
    'styled.div<Props>`margin-left: 1px`',
    'css`margin-left: 1px`',
    'createGlobalStyle`.a { margin-left: 1px }`',
    'injectGlobal`.a { margin-left: 1px }`',
  ])('reads %s', (code) => {
    expect(physical('a.tsx', `const A = ${code}\n`)).toHaveLength(1)
  })

  it.each([
    'keyframes`from { margin-left: 1px }`',
    '`margin-left: 1px`',
    'html`margin-left: 1px`',
  ])('does not read %s', (code) => {
    expect(physical('a.ts', `const A = ${code}\n`)).toEqual([])
  })

  it('reports a declaration after a whole-declaration expression', () => {
    const text = 'const A = styled.div`\n  ${mixin};\n  padding-right: 4px;\n`\n'
    expect(physical('a.ts', text)).toEqual([[3, 3]])
  })

  it('parses a property-name expression without a finding', () => {
    expect(physical('a.ts', 'const A = css`margin-${side}: 4px;`\n')).toEqual([])
  })

  it('keeps line numbers right across multi-line expressions', () => {
    const text = 'const A = styled.div`\n  color: ${(p) => {\n    return p.c\n  }};\n  margin-left: 1px;\n`\n'
    expect(physical('a.ts', text)).toEqual([[5, 3]])
  })

  it('reads a rule position expression and nesting', () => {
    const text = 'const A = styled.div`\n  ${Button}:hover {\n    &:hover { margin-right: 1px }\n  }\n`\n'
    expect(physical('a.ts', text)).toEqual([[3, 15]])
  })

  it('adds no block for a template that does not parse, and keeps the file', () => {
    const file = parseSource('a.ts', 'const A = css`a { margin-left: ;;; }}}`\nconst B = css`margin-left: 1px`\n')
    expect(file).not.toBeNull()
    expect(file?.css).toHaveLength(1)
  })

  it('reads templates in nested expressions', () => {
    const text = 'const A = styled.div`\n  ${(p) => p.x && css`\n    margin-left: 1px;\n  `}\n`\n'
    expect(physical('a.ts', text)).toEqual([[3, 5]])
  })

  it('reads templates in a Vue script block with file offsets', () => {
    const text = '<template><div/></template>\n<script lang="ts">\nconst A = styled.div`\n  margin-left: 1px;\n`\n</script>\n'
    expect(physical('a.vue', text)).toEqual([[4, 3]])
  })
})

describe('template CSS scope and suppression', () => {
  const sheet = 'export const A = styled.div`\n  margin-left: 1px;\n`\n'

  it('goes quiet under a flipper, like a stylesheet', async () => {
    const root = tree({ 'package.json': JSON.stringify({ dependencies: { 'stylis-plugin-rtl': '^2' } }), 'a.tsx': sheet })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings).toEqual([])
    expect(result.quiet).toContainEqual({ reason: 'flipped', files: 1, flipper: 'stylis-plugin-rtl' })
  })

  it('goes quiet under @mui/stylis-plugin-rtl', async () => {
    const root = tree({ 'package.json': JSON.stringify({ dependencies: { '@mui/stylis-plugin-rtl': '^6' } }), 'a.ts': sheet })
    expect((await lint(['.'], { cwd: root })).findings).toEqual([])
  })

  it('is reported without a flipper', async () => {
    const result = await lint(['.'], { cwd: tree({ 'package.json': '{}', 'a.tsx': sheet }) })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/no-rtl-support'])
  })

  it('collapses into the no-rtl-support summary with other physical findings', async () => {
    const root = tree({ 'package.json': '{}', 'a.tsx': sheet, 'b.css': '.a { margin-left: 1px }', 'c.css': '.a { margin-right: 1px }' })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/no-rtl-support'])
    expect(result.findings[0]?.message).toContain('3 sides')
  })

  it('is suppressed by a script comment above a one-line template', () => {
    expect(physical('a.ts', '// dualkit-disable-next-line source/physical-css\nconst A = css`margin-left: 1px`\n')).toEqual([])
  })

  it('is suppressed by a block comment inside the template', () => {
    expect(physical('a.ts', 'const A = css`\n  /* dualkit-disable-next-line */\n  margin-left: 1px;\n  margin-right: 2px;\n`\n')).toEqual([[4, 3]])
  })

  it('is suppressed by a double-slash comment inside the template', () => {
    expect(physical('a.ts', 'const A = css`\n  // dualkit-disable-next-line source/physical-css\n  margin-left: 1px;\n`\n')).toEqual([])
  })
})
