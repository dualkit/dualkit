// Plain-data copies of Figma layers: what the main thread sends to the UI, and what the adapter and the test fixtures read.

export type FigmaRect = { x: number; y: number; width: number; height: number }
export type FigmaLetterSpacing = { readonly value: number; readonly unit: 'PIXELS' | 'PERCENT' }
export type FigmaLineHeight = { readonly value: number; readonly unit: 'PIXELS' | 'PERCENT' } | { readonly unit: 'AUTO' }
export type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID'

/** One run of characters with the same font, size, spacing and leading, from TextNode.getStyledTextSegments. */
export type FigmaSegment = {
  characters: string
  start: number
  end: number
  fontName: { family: string; style: string }
  fontSize: number
  fontWeight: number
  fontStyle: 'REGULAR' | 'ITALIC'
  letterSpacing: FigmaLetterSpacing
  lineHeight: FigmaLineHeight
}

export type FigmaTextSnapshot = {
  kind: 'text'
  id: string
  name: string
  characters: string
  /** Absolute canvas position and size. */
  box: FigmaRect
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAutoResize: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE'
  /** The auto-layout direction of the layer's parent, or null when the layer is the root. Recorded for later rules; none reads it yet. */
  parentLayoutMode: FigmaLayoutMode | null
  segments: FigmaSegment[]
  /** Segments that came back mixed or incomplete and are missing from `segments`, so their text was not checked. */
  unreadSegments: number
}

export type FigmaContainerSnapshot = {
  kind: 'container'
  id: string
  name: string
  type: string
  box: FigmaRect
  layoutMode: FigmaLayoutMode | null
  children: FigmaSnapshot[]
}

export type FigmaSnapshot = FigmaTextSnapshot | FigmaContainerSnapshot
