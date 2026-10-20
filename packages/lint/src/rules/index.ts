import type { LintRule } from '../types'
import { CSS_RULES } from './css'

/** Every source rule, in the order LINT.md lists them. Tasks 4 and 5 add theirs. */
export const RULES: readonly LintRule[] = [...CSS_RULES]
