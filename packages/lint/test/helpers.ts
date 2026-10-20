import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { LintHit, LintRule, SourceFile } from '../src/types'

/** Writes a tree of files under a fresh temp directory and returns its path. */
export function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dualkit-lint-'))
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  return root
}

/** A test rule that reports every occurrence of a word in the file text. */
export function wordRule(id: string, word: string, langs: LintRule['langs'] = ['css', 'scss', 'html', 'js', 'jsx', 'ts', 'tsx']): LintRule {
  return {
    id, severity: 'warning', title: `No ${word}`, why: `${word} is bad.`, fix: `Remove ${word}.`, langs,
    check: (file: SourceFile): LintHit[] => {
      const hits: LintHit[] = []
      for (let i = file.text.indexOf(word); i !== -1; i = file.text.indexOf(word, i + 1)) hits.push({ offset: i, message: `Found ${word}.` })
      return hits
    },
  }
}
