import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseSource, parseSourceOutcome } from './parse'
import { lineStarts, positionAt } from './position'
import { RULES } from './rules'
import { suppressed } from './suppress'
import { createTailwindInfo } from './tailwind-version'
import type { LintContext, LintFinding, LintResult, LintRule, Skipped, SourceFile } from './types'
import { compare, isMinified, walk } from './walk'

/** Built the same way as docsUrl in @dualkit/rules, pointing at LINT.md. */
export const lintDocsUrl = (id: string): string =>
  `https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md#${id.replace(/[^a-z0-9]+/g, '-')}`

const DEFAULT_CONTEXT: LintContext = { tailwindVersion: () => null }

type RuleOptions = { rules?: readonly LintRule[]; ignore?: readonly string[] }

const activeRules = (options: RuleOptions): readonly LintRule[] => {
  const ignore = new Set(options.ignore ?? [])
  return (options.rules ?? RULES).filter((rule) => !ignore.has(rule.id))
}

export const byPosition = (a: LintFinding, b: LintFinding): number =>
  compare(a.file, b.file) || a.line - b.line || a.column - b.column || compare(a.rule, b.rule)

function lintFile(file: SourceFile, rules: readonly LintRule[], ctx: LintContext): LintFinding[] {
  const starts = lineStarts(file.text)
  const findings: LintFinding[] = []
  for (const rule of rules) {
    if (!rule.langs.includes(file.lang)) continue
    for (const hit of rule.check(file, ctx)) {
      const { line, column } = positionAt(starts, hit.offset)
      if (suppressed(file, rule.id, line)) continue
      findings.push({
        rule: rule.id, group: 'source', severity: rule.severity, title: rule.title, message: hit.message, fix: rule.fix,
        docs: lintDocsUrl(rule.id), file: file.path, line, column,
      })
    }
  }
  return findings.sort(byPosition)
}

/** Lints one file's text without touching the disk. A file that does not parse gives no findings. */
export function lintText(
  path: string,
  text: string,
  options: RuleOptions & { ctx?: Partial<LintContext> } = {},
): LintFinding[] {
  const file = parseSource(path, text)
  return file ? lintFile(file, activeRules(options), { ...DEFAULT_CONTEXT, ...options.ctx }) : []
}

/** Walks paths under cwd and lints every supported file. Each file is read once; one that is minified, unreadable or does not parse is listed in skipped. */
export async function lint(paths: string[], options: { cwd: string } & RuleOptions): Promise<LintResult> {
  const { files, skipped: walkSkipped } = walk(paths, options.cwd)
  const rules = activeRules(options)
  const infoOf = createTailwindInfo()
  const ctx: LintContext = {
    tailwindVersion: (file) => infoOf(file.abs, resolve(options.cwd)).version,
    tailwindRange: (file) => infoOf(file.abs, resolve(options.cwd)).range,
  }
  const skipped: Skipped[] = [...walkSkipped]
  const findings: LintFinding[] = []
  let linted = 0
  for (const path of files) {
    const abs = resolve(options.cwd, path)
    let text: string
    try {
      text = await readFile(abs, 'utf8')
    } catch {
      skipped.push({ file: path, reason: 'unreadable' })
      continue
    }
    if (isMinified(text)) {
      skipped.push({ file: path, reason: 'minified' })
      continue
    }
    const outcome = parseSourceOutcome(path, text, abs)
    if ('error' in outcome) {
      skipped.push({ file: path, reason: `parse error: ${outcome.error}` })
      continue
    }
    linted++
    findings.push(...lintFile(outcome.file, rules, ctx))
  }
  return { root: options.cwd, files: linted, skipped, findings: findings.sort(byPosition) }
}
