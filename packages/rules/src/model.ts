// A screen, reduced to what the rules need. The DOM reader fills it today; a Figma reader will later.
export type Direction = 'ltr' | 'rtl'
export type Rect = { x: number; y: number; width: number; height: number }

/** Every node carries a selector-like id, a short HTML snippet and where it sits on the page. */
export type NodeRef = { id: string; snippet: string; box: Rect }

export type Font = {
  families: string[]
  size: number
  /** Pixels, or null when the page leaves it as `normal`. */
  lineHeight: number | null
  letterSpacing: number
  style: 'normal' | 'italic' | 'oblique'
  weight: number
}

/** Whether the run's own webfont family draws a new currency sign (U+20C1, U+20C3, U+20C4), measured in the page. */
export type SignProbe = { codePoint: number; drawnByWebfont: boolean }

export type TextRun = NodeRef & {
  text: string
  /** The nearest block ancestor: the bidi paragraph this text belongs to. */
  blockId: string
  /** The block's text, capped at its first and last 300 characters when longer. */
  blockText: string
  /** Facts about the whole block, measured before the cap, for rules that weigh the middle too. */
  blockArabicShare: number
  blockHasArabic: boolean
  blockArabicWords: number
  blockDir: Direction
  dir: Direction
  lang: string | null
  /** Inside <bdi>, an element with a dir attribute, or unicode-bidi isolate or plaintext, below its block. */
  isolated: boolean
  isLastInBlock: boolean
  /** The run is a whole line closed by a <br>, with nothing else on that line. */
  endsLine: boolean
  font: Font
  lines: number
  /** One entry per new currency sign in the text; empty for every other run. */
  signs: SignProbe[]
  /** Net horizontal flip: the product of scale signs over the element and up to 4 ancestors. */
  mirrored: boolean
  /** The nearest element that flips the run when it is mirrored overall, else null. Runs under one flip share it. */
  mirroredBy: string | null
}

export type PhysicalDeclaration = { property: string; value: string }

export type LayoutNode = NodeRef & {
  dir: Direction
  textAlign: string
  hasOwnText: boolean
  /** The element's own text (not its children's) contains Arabic letters. */
  hasArabicText: boolean
  /** Physical properties the author wrote that render differently on the left and right. */
  physical: PhysicalDeclaration[]
}

export type IconNode = NodeRef & { name: string | null; dir: Direction; mirrored: boolean }

export type FieldKind = 'email' | 'tel' | 'url' | 'number' | 'code' | 'text'
export type FieldNode = NodeRef & { kind: FieldKind; dir: Direction; dirAttr: string | null; placeholder: string; placeholderShown: boolean }

export type LoadedFace = {
  /** No quotes. */
  family: string
  weight: [number, number]
  style: string
  unicodeRange: string
  /** A ratio: 0.9 for `90%`. */
  sizeAdjust: number
  status: 'unloaded' | 'loading' | 'loaded' | 'error'
}

export type LabelNode = NodeRef & { attr: 'aria-label' | 'alt' | 'title'; text: string; lang: string | null }

/** `hidden` is the px cut off: scrollWidth - clientWidth, or scrollHeight - clientHeight. */
export type ClipNode = NodeRef & { axis: 'x' | 'y'; hidden: number; ellipsis: boolean; hasArabic: boolean }

export type ScreenModel = {
  /** dir is the attribute as written; computedDir is how the page body actually runs (dir="auto" resolved). */
  root: { lang: string | null; dir: string | null; computedDir: Direction }
  texts: TextRun[]
  layouts: LayoutNode[]
  icons: IconNode[]
  fields: FieldNode[]
  fonts: LoadedFace[]
  labels: LabelNode[]
  clips: ClipNode[]
  unreadableStylesheets: number
}
