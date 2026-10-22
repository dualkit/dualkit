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
  /** Net mirror: the product of flip signs (the sign of each transform's determinant) over the element and up to 4 ancestors. */
  mirrored: boolean
  /** The nearest element that flips the run when it is mirrored overall, else null. Runs under one flip share it. */
  mirroredBy: string | null
}

export type PhysicalDeclaration = { property: string; value: string }

export type LayoutNode = NodeRef & {
  dir: Direction
  textAlign: string
  hasOwnText: boolean
  /** At least half the letters in the element's own text (not its children's) are Arabic. */
  hasArabicText: boolean
  /** Content box width minus the widest line of the element's own text, in px; 0 when it has no own text. */
  textSlack: number
  /** Physical properties the author wrote that render differently on the left and right. */
  physical: PhysicalDeclaration[]
}

/** `mirrored`: a flip (negative determinant) on the icon or up to 4 ancestors. `turned`: a turn that points it the other way without mirroring, such as rotate(180deg). */
export type IconNode = NodeRef & { name: string | null; dir: Direction; mirrored: boolean; turned: boolean }

export type FieldKind = 'email' | 'tel' | 'url' | 'number' | 'code' | 'text'
/** Which edge of the field the placeholder is painted against: its text-align, start and end resolved against the field's direction. */
export type PlaceholderSide = 'left' | 'right' | 'center'
export type FieldNode = NodeRef & { kind: FieldKind; dir: Direction; dirAttr: string | null; placeholder: string; placeholderShown: boolean; placeholderSide: PlaceholderSide }

export type LoadedFace = {
  /** No quotes. */
  family: string
  weight: [number, number]
  style: string
  unicodeRange: string
  /** A ratio: 0.9 for `90%`. */
  sizeAdjust: number
  status: 'unloaded' | 'loading' | 'loaded' | 'error'
  /**
   * Measured in the page for a loaded face with the default unicode-range whose name does not say Arabic: true when it
   * draws alef (U+0627) itself. Null when it was not measured (an Arabic name, an explicit range, not loaded, or the probe failed).
   */
  drawsArabic: boolean | null
}

export type LabelNode = NodeRef & { attr: 'aria-label' | 'alt' | 'title'; text: string; lang: string | null }

/**
 * `hidden` is the scroll overflow: scrollWidth - clientWidth, or scrollHeight - clientHeight. It counts padding too.
 * `textHidden` is how far the painted text boxes reach past the clip rect on that axis, in px.
 * `visibleShare` is the visible text width divided by the full text width, 0 to 1. On a line cut sideways, the
 * ellipsis's width is taken off the visible part, since it is painted over it.
 */
export type ClipNode = NodeRef & { axis: 'x' | 'y'; hidden: number; textHidden: number; visibleShare: number; ellipsis: boolean; hasArabic: boolean }

/** An Arabic word that an inline-block or inline-flex box splits, so its letters cannot join across the box. */
export type JoinBreak = NodeRef & { reason: 'inline-block' | 'font-family' | 'other'; word: string }

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
  joins: JoinBreak[]
  unreadableStylesheets: number
  /** The width of the viewport the page was read at, in CSS px, without a scrollbar. Boxes are in page coordinates. */
  viewportWidth: number
}
