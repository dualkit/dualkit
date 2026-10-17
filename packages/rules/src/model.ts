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
  font: Font
  lines: number
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
export type FieldNode = NodeRef & { kind: FieldKind; dir: Direction; dirAttr: string | null }

export type ScreenModel = {
  root: { lang: string | null; dir: string | null }
  texts: TextRun[]
  layouts: LayoutNode[]
  icons: IconNode[]
  fields: FieldNode[]
  unreadableStylesheets: number
}
