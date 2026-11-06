import type { FigmaLayoutMode, FigmaRect, FigmaSegment, FigmaSnapshot, FigmaTextSnapshot } from './snapshot-types'

// Copies live Figma nodes into plain data. It runs on the plugin's main thread, which has no Intl and no DOM, so it only reads
// properties: the rules run in the UI. The node types below are the structural subset of the Plugin API this file reads.

export type SegmentField = 'fontName' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'letterSpacing' | 'lineHeight'
export const SEGMENT_FIELDS: SegmentField[] = ['fontName', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight']

/** A styled segment as the Plugin API returns it. Values are `unknown` because a mixed value arrives as the figma.mixed symbol. */
export type LiveSegment = { characters: string; start: number; end: number } & { [K in SegmentField]?: unknown }

export type LiveNode = {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly visible?: boolean
  readonly absoluteBoundingBox?: FigmaRect | null
  readonly width?: number
  readonly height?: number
  readonly layoutMode?: FigmaLayoutMode
  readonly children?: readonly LiveNode[]
}

export type LiveText = LiveNode & {
  readonly type: 'TEXT'
  readonly characters: string
  readonly textAlignHorizontal: FigmaTextSnapshot['textAlignHorizontal']
  readonly textAutoResize: FigmaTextSnapshot['textAutoResize']
  getStyledTextSegments(fields: SegmentField[]): readonly LiveSegment[]
}

const isText = (node: LiveNode): node is LiveText => node.type === 'TEXT' && typeof (node as Partial<LiveText>).characters === 'string'
const isShown = (node: LiveNode): boolean => node.visible !== false

const boxOf = (node: LiveNode): FigmaRect => {
  const b = node.absoluteBoundingBox
  return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : { x: 0, y: 0, width: node.width ?? 0, height: node.height ?? 0 }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** A segment with every field set to a real value, or null when any is mixed or missing. */
function toSegment(s: LiveSegment): FigmaSegment | null {
  const { fontName, fontSize, fontWeight, fontStyle, letterSpacing, lineHeight } = s
  if (!isRecord(fontName) || typeof fontName.family !== 'string' || typeof fontName.style !== 'string') return null
  if (typeof fontSize !== 'number' || typeof fontWeight !== 'number') return null
  if (fontStyle !== 'REGULAR' && fontStyle !== 'ITALIC') return null
  if (!isRecord(letterSpacing) || !isRecord(lineHeight)) return null
  return {
    characters: s.characters, start: s.start, end: s.end,
    fontName: { family: fontName.family, style: fontName.style }, fontSize, fontWeight, fontStyle,
    letterSpacing: letterSpacing as FigmaSegment['letterSpacing'],
    lineHeight: lineHeight as FigmaSegment['lineHeight'],
  }
}

function snapshotText(node: LiveText, parentLayoutMode: FigmaLayoutMode | null): FigmaTextSnapshot {
  const raw = node.getStyledTextSegments(SEGMENT_FIELDS)
  const segments = raw.flatMap((s) => toSegment(s) ?? [])
  return {
    kind: 'text', id: node.id, name: node.name, characters: node.characters, box: boxOf(node),
    textAlignHorizontal: node.textAlignHorizontal, textAutoResize: node.textAutoResize, parentLayoutMode,
    segments, unreadSegments: raw.length - segments.length,
  }
}

function walk(node: LiveNode, parentLayoutMode: FigmaLayoutMode | null): FigmaSnapshot {
  if (isText(node)) return snapshotText(node, parentLayoutMode)
  const layoutMode = node.layoutMode ?? null
  return {
    kind: 'container', id: node.id, name: node.name, type: node.type, box: boxOf(node), layoutMode,
    children: (node.children ?? []).filter(isShown).map((child) => walk(child, layoutMode)),
  }
}

/** A plain-data copy of a layer and its visible descendants, safe to post to the UI. */
export const snapshot = (node: LiveNode): FigmaSnapshot => walk(node, null)

/** The visible text layers in a selection: selected text layers and the text inside selected frames, each once, in order. */
export function collectTextLayers(selection: readonly LiveNode[]): LiveText[] {
  const seen = new Set<string>()
  const out: LiveText[] = []
  const visit = (node: LiveNode): void => {
    if (!isShown(node)) return
    if (isText(node)) {
      if (!seen.has(node.id)) {
        seen.add(node.id)
        out.push(node)
      }
      return
    }
    for (const child of node.children ?? []) visit(child)
  }
  for (const node of selection) visit(node)
  return out
}
