import type { NodeRef, ScreenModel } from './model'

export type Severity = 'error' | 'warning' | 'note'
export type Group = 'bidi' | 'layout' | 'icons' | 'type' | 'content'
export type Hit = { node: NodeRef | null; message: string }

export type Rule = {
  id: string
  group: Group
  severity: Severity
  title: string
  /** One sentence on what goes wrong for the person using the screen. */
  why: string
  /** One sentence on the fix. */
  fix: string
  check: (model: ScreenModel) => Hit[]
}

export type Finding = {
  rule: string
  group: Group
  severity: Severity
  title: string
  message: string
  fix: string
  docs: string
  node: NodeRef | null
  /** Set on review findings only; check findings leave it out. */
  source?: 'check' | 'review'
  /** 0 to 1, review findings only. */
  confidence?: number
  /** Line in the local source file, or null when the target is a URL. */
  line?: number | null
}

export const defineRule = (rule: Rule): Rule => rule

/** Findings carry only the reference, not the whole text run or layout node. */
export const pick = ({ id, snippet, box }: NodeRef): NodeRef => ({ id, snippet, box })
