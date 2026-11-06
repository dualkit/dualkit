import { runRules, type Finding, type Group, type Severity } from '@dualkit/rules'
import { figmaToScreenModel } from './adapter'
import { CHECKED_IN_FIGMA, NOT_CHECKED_IN_FIGMA, type SkippedRule } from './coverage'
import type { FigmaSnapshot, FigmaTextSnapshot } from './snapshot-types'

export type LayerHit = { layerId: string; layerName: string; message: string }
export type RuleGroup = { rule: string; group: Group; severity: Severity; title: string; fix: string; docs: string; hits: LayerHit[] }
/** A layer with segments the snapshot could not read: its text was only partly checked. */
export type UnreadLayer = { layerId: string; layerName: string; segments: number }
export type CheckResult = { findings: Finding[]; groups: RuleGroup[]; notChecked: readonly SkippedRule[]; layers: number; unread: UnreadLayer[] }

const textLayers = (node: FigmaSnapshot): FigmaTextSnapshot[] => (node.kind === 'text' ? [node] : node.children.flatMap(textLayers))

/** Findings grouped by rule, in the order runRules sorts them: errors first. */
function groupByRule(findings: readonly Finding[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>()
  for (const f of findings) {
    const hit = { layerId: f.node?.id ?? '', layerName: f.node?.snippet ?? '', message: f.message }
    const existing = groups.get(f.rule)
    groups.set(f.rule, existing
      ? { ...existing, hits: [...existing.hits, hit] }
      : { rule: f.rule, group: f.group, severity: f.severity, title: f.title, fix: f.fix, docs: f.docs, hits: [hit] })
  }
  return [...groups.values()]
}

/** Runs the rules that work on Figma data against a frame snapshot. */
export function checkFrame(root: FigmaSnapshot): CheckResult {
  const findings = runRules(figmaToScreenModel(root), { rules: CHECKED_IN_FIGMA })
  const layers = textLayers(root)
  const unread = layers
    .filter((l) => l.unreadSegments > 0)
    .map((l) => ({ layerId: l.id, layerName: l.name, segments: l.unreadSegments }))
  return { findings, groups: groupByRule(findings), notChecked: NOT_CHECKED_IN_FIGMA, layers: layers.length, unread }
}
