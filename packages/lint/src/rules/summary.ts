import type { LintRule } from '../types'

/** Id of the repo-level summary. lint() builds the finding itself, once every file is linted. */
export const NO_RTL_SUPPORT = 'source/no-rtl-support'

const noRtlSupport: LintRule = {
  id: NO_RTL_SUPPORT,
  severity: 'note',
  title: 'This repo has no right-to-left support yet',
  why: 'When nothing in the repo sets a direction, translates to Arabic or Hebrew, or uses an rtl: variant, hundreds of left and right findings would bury the one real decision: whether to support right-to-left at all.',
  fix: 'Decide on right-to-left first: set dir on the root element from the active locale, then use logical properties and classes for new code. Add the rtl: variant or a dir rule where a side must stay fixed. Until then lint reports this one finding in place of the individual left and right ones.',
  langs: [],
  check: () => [],
}

export const SUMMARY_RULES: readonly LintRule[] = [noRtlSupport]
