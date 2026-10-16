import type { Rule } from '../rule'
import { bidiRules } from './bidi'
import { contentRules } from './content'
import { iconRules } from './icons'
import { layoutRules } from './layout'
import { typeRules } from './type'

export const RULES: readonly Rule[] = [...bidiRules, ...layoutRules, ...iconRules, ...typeRules, ...contentRules]
