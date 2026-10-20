import { describe, expect, it } from 'vitest'
import { parseSource } from '../src/parse'
import { lintText } from '../src/run'
import { suppressed } from '../src/suppress'
import { wordRule } from './helpers'

const oops = wordRule('test/bad', 'oops')
const other = wordRule('test/other', 'oops')
const lines = (path: string, text: string, rules = [oops]): number[] => lintText(path, text, { rules }).map((f) => f.line)

describe('dualkit-disable-next-line', () => {
  it('works in a // comment', () => {
    expect(lines('a.ts', '// dualkit-disable-next-line test/bad\nconst oops = 1\nconst oops2 = 2\n')).toEqual([3])
  })

  it('works in a /* */ comment with a list of ids', () => {
    expect(lintText('a.js', '/* dualkit-disable-next-line test/bad, test/other */\nbad()\n', { rules: [oops, other] })).toEqual([])
  })

  it('works in a JSX comment', () => {
    expect(lines('a.tsx', 'export const A = () => (\n  <div>\n    {/* dualkit-disable-next-line test/bad */}\n    <p className="oops" />\n  </div>\n)\n')).toEqual([])
  })

  it('works in a CSS comment', () => {
    expect(lines('a.css', '/* dualkit-disable-next-line test/bad */\n.oops {}\n.oops {}\n')).toEqual([3])
  })

  it('works in an SCSS // comment', () => {
    expect(lines('a.scss', '// dualkit-disable-next-line test/bad\n.oops {}\n.oops {}\n')).toEqual([3])
  })

  it('works in an HTML comment, and in comments inside its style and script blocks', () => {
    const html = '<!-- dualkit-disable-next-line test/bad -->\n<p class="oops"></p>\n<style>\n/* dualkit-disable-next-line test/bad */\n.oops {}\n</style>\n<script>\n// dualkit-disable-next-line test/bad\nbad()\n</script>\n<p class="oops"></p>\n'
    expect(lines('a.html', html)).toEqual([11])
  })

  it('works with CRLF line ends', () => {
    expect(lines('a.ts', '// dualkit-disable-next-line test/bad\r\nconst oops = 1\r\nconst oops2 = 2\r\n')).toEqual([3])
  })

  it('leaves other rules alone', () => {
    expect(lintText('a.ts', '// dualkit-disable-next-line test/other\nconst oops = 1\n', { rules: [oops] })).toHaveLength(1)
  })

  it('with no id turns off every rule', () => {
    expect(lintText('a.ts', '// dualkit-disable-next-line\nconst oops = 1\n', { rules: [oops, other] })).toEqual([])
  })

  it('accepts a reason after --', () => {
    expect(lines('a.ts', '// dualkit-disable-next-line test/bad -- brand name\nconst oops = 1\n')).toEqual([])
  })
})

describe('dualkit-disable', () => {
  it('turns a rule off for the whole file wherever it sits', () => {
    expect(lines('a.ts', 'const oops = 1\nconst oops2 = 2\n// dualkit-disable test/bad\n')).toEqual([])
    expect(lines('a.css', '.oops {}\n/* dualkit-disable test/bad */\n.oops {}\n')).toEqual([])
    expect(lines('a.html', '<p class="oops"></p>\n<!-- dualkit-disable test/bad -->\n')).toEqual([])
  })

  it('leaves other rules alone', () => {
    expect(lines('a.ts', '// dualkit-disable test/other\nconst oops = 1\n')).toEqual([2])
  })

  it('with no id turns off every rule', () => {
    expect(lintText('a.ts', '/* dualkit-disable */\nconst oops = 1\n', { rules: [oops, other] })).toEqual([])
  })
})

describe('directives that do not count', () => {
  it('ignores a directive inside a string literal', () => {
    expect(lines('a.ts', 'const s = "// dualkit-disable test/bad"\nconst oops = 1\n')).toEqual([2])
    expect(lines('a.ts', 'const s = `/* dualkit-disable-next-line */`\nconst oops = 1\n')).toEqual([2])
  })

  it('ignores a directive inside a CSS string or HTML attribute', () => {
    expect(lines('a.css', '.a::before { content: "/* dualkit-disable */" }\n.oops {}\n')).toEqual([2])
    expect(lines('a.html', '<p title="<!-- dualkit-disable -->">x</p>\n<p class="oops"></p>\n')).toEqual([2])
  })

  it('ignores a word that only starts like a directive', () => {
    expect(lines('a.ts', '// dualkit-disabled test/bad\nconst oops = 1\n')).toEqual([2])
  })
})

describe('suppressed', () => {
  it('answers for a rule and a line', () => {
    const file = parseSource('a.ts', 'const a = 1\n// dualkit-disable-next-line test/bad\nconst b = 2\n')
    if (!file) throw new Error('did not parse')
    expect(suppressed(file, 'test/bad', 3)).toBe(true)
    expect(suppressed(file, 'test/bad', 2)).toBe(false)
    expect(suppressed(file, 'test/other', 3)).toBe(false)
  })
})
