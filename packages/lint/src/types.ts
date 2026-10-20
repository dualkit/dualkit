import type { File } from '@babel/types'
import type { Severity } from '@dualkit/rules'
import type { DefaultTreeAdapterMap } from 'parse5'
import type { Root } from 'postcss'

export type Lang = 'css' | 'scss' | 'html' | 'js' | 'jsx' | 'ts' | 'tsx'
export type JsLang = 'js' | 'jsx' | 'ts' | 'tsx'

export type CssBlock = { root: Root; offset: number }
export type JsBlock = { ast: File; offset: number; lang: JsLang }

export type SourceFile = {
  /** Relative to the lint root, with forward slashes. */
  path: string
  abs: string
  lang: Lang
  /** The file text with any leading byte order mark removed. Every offset points into this. */
  text: string
  /** One entry for a CSS or SCSS file (offset 0), one per inline <style> in an HTML file. */
  css: CssBlock[]
  /** One entry for a JS or TS file (offset 0), one per inline <script> in an HTML file. */
  js: JsBlock[]
  html: DefaultTreeAdapterMap['document'] | null
}

/** offset is a character index into SourceFile.text. */
export type LintHit = { offset: number; message: string }

export type LintContext = {
  /** The Tailwind version that applies to a file, or null when none is found. */
  tailwindVersion: (file: SourceFile) => string | null
}

export type LintRule = {
  id: string
  severity: Severity
  title: string
  /** One sentence on what goes wrong for the person using the screen. */
  why: string
  /** One sentence on the fix. */
  fix: string
  langs: readonly Lang[]
  check: (file: SourceFile, ctx: LintContext) => LintHit[]
}

export type LintFinding = {
  rule: string
  group: 'source'
  severity: Severity
  title: string
  message: string
  fix: string
  docs: string
  file: string
  /** 1-based. */
  line: number
  /** 1-based, in UTF-16 code units from the start of the line. */
  column: number
}

export type Skipped = { file: string; reason: string }

export type LintResult = { root: string; files: number; skipped: Skipped[]; findings: LintFinding[] }
