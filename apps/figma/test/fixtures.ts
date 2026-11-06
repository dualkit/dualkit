import type { FigmaContainerSnapshot, FigmaLineHeight, FigmaLetterSpacing, FigmaSegment, FigmaSnapshot, FigmaTextSnapshot } from '../src/snapshot-types'

export const ARABIC_FONT = 'IBM Plex Sans Arabic'

type SegmentStyle = {
  family?: string
  style?: string
  size?: number
  weight?: number
  italic?: boolean
  lineHeight?: FigmaLineHeight
  letterSpacing?: FigmaLetterSpacing
}

type TextOptions = SegmentStyle & {
  id?: string
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  align?: FigmaTextSnapshot['textAlignHorizontal']
  autoResize?: FigmaTextSnapshot['textAutoResize']
  /** Segments the snapshot could not read, so they are missing from `segments`. */
  unread?: number
  /** Characters split into differently styled pieces; the pieces join into the layer's text. */
  pieces?: ReadonlyArray<{ text: string } & SegmentStyle>
}

let counter = 0

function segment(characters: string, start: number, s: SegmentStyle): FigmaSegment {
  return {
    characters,
    start,
    end: start + characters.length,
    fontName: { family: s.family ?? ARABIC_FONT, style: s.style ?? 'Regular' },
    fontSize: s.size ?? 16,
    fontWeight: s.weight ?? 400,
    fontStyle: s.italic ? 'ITALIC' : 'REGULAR',
    letterSpacing: s.letterSpacing ?? { unit: 'PIXELS', value: 0 },
    lineHeight: s.lineHeight ?? { unit: 'PIXELS', value: 27 },
  }
}

/** A text layer snapshot. Defaults describe well-set Arabic: an Arabic family, 16px, 27px leading, no tracking, right aligned. */
export function text(characters: string, o: TextOptions = {}): FigmaTextSnapshot {
  counter += 1
  const pieces = o.pieces ?? [{ text: characters }]
  let at = 0
  const segments = pieces.map((p) => {
    const s = segment(p.text, at, { ...o, ...p })
    at += p.text.length
    return s
  })
  return {
    kind: 'text',
    id: o.id ?? `1:${counter}`,
    name: o.name ?? characters.slice(0, 20),
    characters: pieces.map((p) => p.text).join(''),
    box: { x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 320, height: o.height ?? 27 },
    textAlignHorizontal: o.align ?? 'RIGHT',
    textAutoResize: o.autoResize ?? 'HEIGHT',
    parentLayoutMode: 'VERTICAL',
    segments,
    unreadSegments: o.unread ?? 0,
  }
}

export function frame(children: FigmaSnapshot[], o: { id?: string; width?: number; x?: number; y?: number } = {}): FigmaContainerSnapshot {
  return {
    kind: 'container',
    id: o.id ?? '0:1',
    name: 'Screen',
    type: 'FRAME',
    box: { x: o.x ?? 0, y: o.y ?? 0, width: o.width ?? 390, height: 844 },
    layoutMode: 'VERTICAL',
    children,
  }
}
