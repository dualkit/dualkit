import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { parseSource, parseSourceOutcome } from './parse'
import { lineStarts, positionAt } from './position'
import { DEFAULT_RULES } from './rules'
import { NO_RTL_SUPPORT } from './rules/summary'
import { hasRtlLocaleFiles, hasRtlSignal, isRtlLocalePath } from './rtl-signal'
import { createFlipperLookup, quietReason } from './scope'
import { suppressed } from './suppress'
import { createTailwindInfo } from './tailwind-version'
import type { LintContext, LintFinding, LintResult, LintRule, QuietEntry, QuietReason, Skipped, SourceFile } from './types'
import { compare, gitignores, isMinified, repoTop, walk } from './walk'

/** Built the same way as docsUrl in @dualkit/rules, pointing at LINT.md. */
export const lintDocsUrl = (id: string): string =>
  `https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md#${id.replace(/[^a-z0-9]+/g, '-')}`

const DEFAULT_CONTEXT: LintContext = { tailwindVersion: () => null }

type RuleOptions = { rules?: readonly LintRule[]; ignore?: readonly string[] }

const activeRules = (options: RuleOptions): readonly LintRule[] => {
  const ignore = new Set(options.ignore ?? [])
  return (options.rules ?? DEFAULT_RULES).filter((rule) => !ignore.has(rule.id))
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

/** A script file with CSS in template literals: a build-time flipper mirrors that CSS like a stylesheet's. */
const holdsTemplateCss = (file: SourceFile): boolean => file.js.length > 0 && file.html === null && file.css.length > 0

const PHYSICAL_RULES = new Set(['source/physical-css', 'source/physical-tailwind'])

/** Replaces every physical finding with one summary at the first of them. */
function collapsePhysical(findings: readonly LintFinding[], rule: LintRule): LintFinding[] {
  const physical = findings.filter((f) => PHYSICAL_RULES.has(f.rule))
  const first = [...physical].sort(byPosition)[0]
  if (!first) return [...findings]
  const count = physical.length.toLocaleString('en-US')
  const summary: LintFinding = {
    rule: rule.id, group: 'source', severity: rule.severity, title: rule.title, fix: rule.fix, docs: lintDocsUrl(rule.id),
    message: `${count} ${physical.length === 1 ? 'side is' : 'sides are'} set left or right. This repo has no right-to-left support yet; start here.`,
    file: first.file, line: first.line, column: first.column,
  }
  return [...findings.filter((f) => !PHYSICAL_RULES.has(f.rule)), summary]
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
  const cwd = resolve(options.cwd)
  const flipperOf = createFlipperLookup(repoTop(cwd) ?? cwd)
  const flippers = new Map<string, string | null>()
  const reasons = new Map<string, QuietReason | null>()
  const reasonOf = (file: SourceFile): QuietReason | null => {
    const known = reasons.get(file.path)
    if (known !== undefined) return known
    const flipper = file.lang === 'css' || file.lang === 'scss' || holdsTemplateCss(file) ? flipperOf(file.abs) : null
    flippers.set(file.path, flipper)
    const reason = quietReason(file.path, file.text) ?? (flipper ? 'flipped' : null)
    reasons.set(file.path, reason)
    return reason
  }
  ctx.physicalQuiet = reasonOf
  const tally = new Map<string, QuietEntry>()
  const skipped: Skipped[] = [...walkSkipped]
  const findings: LintFinding[] = []
  let linted = 0
  let rtlSupport = false
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
    // The text is dropped after this file, so only the yes or no is kept.
    if (!rtlSupport && (hasRtlSignal(text) || isRtlLocalePath(path))) rtlSupport = true
    const outcome = parseSourceOutcome(path, text, abs)
    if ('error' in outcome) {
      skipped.push({ file: path, reason: `parse error: ${outcome.error}` })
      continue
    }
    linted++
    const reason = reasonOf(outcome.file)
    if (reason) {
      // A flipper in the build means the repo already mirrors its left and right for right-to-left.
      if (reason === 'flipped') rtlSupport = true
      const flipper = reason === 'flipped' ? flippers.get(path) ?? undefined : undefined
      const key = `${reason}:${flipper ?? ''}`
      const entry = tally.get(key)
      tally.set(key, entry ? { ...entry, files: entry.files + 1 } : { reason, files: 1, ...(flipper ? { flipper } : {}) })
    }
    findings.push(...lintFile(outcome.file, rules, ctx))
  }
  const summary = rules.find((rule) => rule.id === NO_RTL_SUPPORT)
  const hasPhysical = findings.some((f) => PHYSICAL_RULES.has(f.rule))
  const top = repoTop(cwd) ?? cwd
  // A subset run only sees part of the repo, so it cannot tell that the repo has no right-to-left support.
  const coversRepo = paths.some((p) => {
    const abs = resolve(options.cwd, p)
    return top === abs || top.startsWith(abs.endsWith(sep) ? abs : abs + sep)
  })
  const collapse = summary !== undefined && hasPhysical && coversRepo && !rtlSupport && !hasRtlLocaleFiles(top, gitignores(top))
  const final = collapse ? collapsePhysical(findings, summary) : findings
  return { root: options.cwd, files: linted, skipped, findings: final.sort(byPosition), quiet: [...tally.values()] }
}
