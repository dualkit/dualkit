import { arabicShare, arabicWordCount, firstStrong, hasArabic, type Direction, type Font, type LayoutNode, type LoadedFace, type Rect, type ScreenModel, type TextRun } from '@dualkit/rules'
import type { FigmaContainerSnapshot, FigmaLetterSpacing, FigmaLineHeight, FigmaRect, FigmaSegment, FigmaSnapshot, FigmaTextSnapshot } from './snapshot-types'

// Reads a Figma frame into the screen model the rules read in the browser. Figma knows the text, its fonts, spacing, leading
// and alignment. It has no HTML: no lang or dir, no isolation, no form fields, no CSS. Those parts of the model stay empty, and
// the rules that need them are listed in coverage.ts as not checked.

/** Figma has no unicode-range and no way to ask a font which glyphs it draws, so faces are judged by family name, as the default range is in the browser. */
const DEFAULT_RANGE = 'U+0-10FFFF'
const ITALIC_NAME = /italic/i
const OBLIQUE_NAME = /oblique/i

const toPx = (v: FigmaLetterSpacing | Extract<FigmaLineHeight, { value: number }>, size: number): number =>
  v.unit === 'PIXELS' ? v.value : (v.value / 100) * size

const lineHeightPx = (lh: FigmaLineHeight, size: number): number | null => (lh.unit === 'AUTO' ? null : toPx(lh, size))

function fontStyle(s: FigmaSegment): Font['style'] {
  if (s.fontStyle === 'ITALIC' || ITALIC_NAME.test(s.fontName.style)) return 'italic'
  return OBLIQUE_NAME.test(s.fontName.style) ? 'oblique' : 'normal'
}

const fontOf = (s: FigmaSegment): Font => ({
  families: [s.fontName.family],
  size: s.fontSize,
  lineHeight: lineHeightPx(s.lineHeight, s.fontSize),
  letterSpacing: toPx(s.letterSpacing, s.fontSize),
  style: fontStyle(s),
  weight: s.fontWeight,
})

const relative = (box: FigmaRect, origin: FigmaRect): Rect => ({ x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height })

const directionOf = (text: string): Direction => firstStrong(text) ?? 'ltr'

type Paragraph = { text: string; start: number; end: number; index: number }

/** Figma starts a new paragraph at each line feed, and gives each paragraph its own direction from its first strong letter. */
function paragraphs(characters: string): Paragraph[] {
  let start = 0
  return characters.split('\n').map((text, index) => {
    const p = { text, start, end: start + text.length, index }
    start = p.end + 1
    return p
  })
}

/**
 * Lines a paragraph wraps to. The layer's lines come from its height and leading (one when the leading is auto, since the height
 * then says nothing). Figma does not say where each paragraph breaks, so every paragraph, empty ones included, takes one line, and
 * the lines left over go to the paragraphs by their share of the characters. A layer of one-line labels so never counts as wrapped.
 */
function lineCount(height: number, font: Font, p: Paragraph, all: readonly Paragraph[]): number {
  const layerLines = font.lineHeight ? Math.max(1, Math.round(height / font.lineHeight)) : 1
  if (all.length === 1) return layerLines
  const spare = Math.max(0, layerLines - all.length)
  const characters = all.reduce((n, q) => n + q.text.length, 0)
  return 1 + Math.round((spare * p.text.length) / Math.max(1, characters))
}

function runsOfParagraph(layer: FigmaTextSnapshot, p: Paragraph, all: readonly Paragraph[], origin: FigmaRect): TextRun[] {
  const pieces = layer.segments
    .map((s) => ({ s, text: layer.characters.slice(Math.max(s.start, p.start), Math.min(s.end, p.end)) }))
    .filter(({ text }) => text.trim() !== '')
  const blockDir = directionOf(p.text)
  const box = relative(layer.box, origin)
  return pieces.map(({ s, text }, i) => {
    const font = fontOf(s)
    return {
      id: layer.id, snippet: layer.name, box, text,
      blockId: `${layer.id}#${p.index}`, blockText: p.text,
      blockArabicShare: arabicShare(p.text), blockHasArabic: hasArabic(p.text), blockArabicWords: arabicWordCount(p.text),
      blockDir, dir: blockDir, lang: null, isolated: false, forcedLtr: false,
      isLastInBlock: i === pieces.length - 1, endsLine: false, font, lines: lineCount(layer.box.height, font, p, all),
      signs: [], mirrored: false, mirroredBy: null,
    }
  })
}

const ALIGN: Record<FigmaTextSnapshot['textAlignHorizontal'], string> = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }

/**
 * Figma does not report the width of a layer's longest line. An auto-width layer hugs its text, so it has no slack; any other
 * layer has a set width the text may not fill, so its width stands in as the slack and alignment counts.
 */
const slackOf = (layer: FigmaTextSnapshot): number => (layer.textAutoResize === 'WIDTH_AND_HEIGHT' ? 0 : layer.box.width)

const layoutOf = (layer: FigmaTextSnapshot, origin: FigmaRect): LayoutNode => ({
  id: layer.id, snippet: layer.name, box: relative(layer.box, origin),
  dir: directionOf(layer.characters), textAlign: ALIGN[layer.textAlignHorizontal],
  hasOwnText: layer.characters.trim() !== '', hasArabicText: arabicShare(layer.characters) >= 0.5,
  textSlack: slackOf(layer), physical: [],
})

function textLayers(node: FigmaSnapshot): FigmaTextSnapshot[] {
  return node.kind === 'text' ? [node] : (node as FigmaContainerSnapshot).children.flatMap(textLayers)
}

function facesOf(runs: readonly TextRun[]): LoadedFace[] {
  const faces = new Map<string, LoadedFace>()
  for (const { font } of runs) {
    const family = font.families[0] ?? ''
    const style = font.style === 'normal' ? 'normal' : 'italic'
    const key = `${family.toLowerCase()}|${font.weight}|${style}`
    if (!faces.has(key)) {
      faces.set(key, { family, weight: [font.weight, font.weight], style, unicodeRange: DEFAULT_RANGE, sizeAdjust: 1, status: 'loaded', drawsArabic: null })
    }
  }
  return [...faces.values()]
}

/** The screen model for a frame, group, section or single text layer, with boxes measured from its top-left corner. */
export function figmaToScreenModel(root: FigmaSnapshot): ScreenModel {
  const layers = textLayers(root)
  const texts = layers.flatMap((layer) => {
    const all = paragraphs(layer.characters)
    return all.flatMap((p) => runsOfParagraph(layer, p, all, root.box))
  })
  const share = arabicShare(texts.map((t) => t.text).join(' '))
  return {
    root: { lang: null, dir: null, computedDir: share > 0.5 ? 'rtl' : 'ltr' },
    texts,
    layouts: layers.map((layer) => layoutOf(layer, root.box)),
    icons: [], fields: [], fonts: facesOf(texts), labels: [], clips: [], joins: [],
    unreadableStylesheets: 0,
    viewportWidth: root.box.width,
  }
}
