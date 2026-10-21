import type { LintRule } from '../types'
import { CSS_RULES } from './css'
import { INTL_RULES } from './intl'
import { RIAL_RULES } from './rial'
import { SUMMARY_RULES } from './summary'
import { TAILWIND_RULES } from './tailwind'

/** Every source rule, in the order LINT.md lists them. Task 4 adds the rest. */
export const RULES: readonly LintRule[] = [...CSS_RULES, ...TAILWIND_RULES, ...INTL_RULES, ...RIAL_RULES, ...SUMMARY_RULES]

/** What runs when no rules are given. The dir attribute rule is opt-in, so it is left out. */
export const DEFAULT_RULES: readonly LintRule[] = RULES.filter((rule) => rule.id !== 'source/dir-attribute-selector')
