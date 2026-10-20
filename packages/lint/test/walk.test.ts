import { symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { walk } from '../src/walk'
import { tree } from './helpers'

describe('walk', () => {
  it('honours a root and a nested .gitignore', () => {
    const root = tree({
      '.gitignore': 'secret.css\n',
      'a.css': '',
      'secret.css': '',
      'pkg/.gitignore': 'gen/\n*.tmp.ts\n',
      'pkg/b.ts': '',
      'pkg/c.tmp.ts': '',
      'pkg/gen/d.ts': '',
      'other/gen/e.ts': '',
    })
    expect(walk(['.'], root).files).toEqual(['a.css', 'other/gen/e.ts', 'pkg/b.ts'])
  })

  it('applies an ancestor .gitignore when walking a subdirectory', () => {
    const root = tree({ '.gitignore': 'skip.js\n', 'src/skip.js': '', 'src/keep.js': '' })
    expect(walk(['src'], root).files).toEqual(['src/keep.js'])
  })

  it('always skips node_modules, dist, .next, build, coverage and .git', () => {
    const root = tree({
      'node_modules/x/a.js': '', 'dist/a.js': '', '.next/a.js': '', 'build/a.js': '', 'coverage/a.js': '', '.git/a.js': '',
      'src/node_modules/b.js': '', 'src/ok.js': '',
    })
    expect(walk(['.'], root).files).toEqual(['src/ok.js'])
  })

  it('lists only the supported extensions and skips .d.ts', () => {
    const root = tree({
      'a.css': '', 'b.scss': '', 'c.html': '', 'd.htm': '', 'e.js': '', 'f.mjs': '', 'g.cjs': '', 'h.jsx': '',
      'i.ts': '', 'j.mts': '', 'k.cts': '', 'l.tsx': '', 'm.d.ts': '', 'n.vue': '', 'o.md': '', 'p.svelte': '',
    })
    expect(walk(['.'], root).files).toEqual(['a.css', 'b.scss', 'c.html', 'd.htm', 'e.js', 'f.mjs', 'g.cjs', 'h.jsx', 'i.ts', 'j.mts', 'k.cts', 'l.tsx'])
  })

  it('skips a symlink to a parent directory without hanging', () => {
    const root = tree({ 'src/a.ts': '' })
    symlinkSync(root, join(root, 'src', 'loop'), 'dir')
    expect(walk(['.'], root).files).toEqual(['src/a.ts'])
  })

  it('handles a path with a space', () => {
    const root = tree({ 'my dir/a b.css': '' })
    expect(walk(['my dir'], root).files).toEqual(['my dir/a b.css'])
    expect(walk(['my dir/a b.css'], root).files).toEqual(['my dir/a b.css'])
  })

  it('skips a file over 1 MB as minified even with short lines', () => {
    const root = tree({ 'big.css': 'a{}\n'.repeat(300_000) })
    expect(walk(['.'], root).skipped).toEqual([{ file: 'big.css', reason: 'minified' }])
  })

  it('records a missing path as skipped and dedupes overlapping paths', () => {
    const root = tree({ 'src/a.ts': '' })
    const result = walk(['src', 'src/a.ts', 'nope'], root)
    expect(result.files).toEqual(['src/a.ts'])
    expect(result.skipped).toEqual([{ file: 'nope', reason: 'not found' }])
  })

  it('matches extensions in any case', () => {
    const root = tree({ 'FOO.HTML': '', 'Bar.CSS': '', 'x.D.TS': '' })
    expect(walk(['.'], root).files).toEqual(['Bar.CSS', 'FOO.HTML'])
  })

  it('records an explicit file with an unsupported extension as skipped', () => {
    const root = tree({ 'a.vue': '', 'b.d.ts': '' })
    expect(walk(['a.vue', 'b.d.ts'], root)).toMatchObject({ files: [], skipped: [{ file: 'a.vue', reason: 'unsupported file type' }, { file: 'b.d.ts', reason: 'unsupported file type' }] })
  })

  it('lists a long-line file without reading it, and returns only files and skipped', () => {
    const root = tree({ 'app.min.js': `var a=${'1+'.repeat(300_000)}1;` })
    expect(walk(['.'], root)).toEqual({ files: ['app.min.js'], skipped: [] })
  })
})
