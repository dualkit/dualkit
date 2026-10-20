import type { LoadedFace, TextRun } from './model'
import { ARABIC_FAMILY_NAME } from './text'

const ARABIC_LETTER_ALEF = 0x627
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** One `U+` range token to [lo, hi]; `?` wildcards stand for any hex digit. Null when it cannot be read. */
function parseRange(token: string): [number, number] | null {
  const m = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i.exec(token.trim())
  if (!m) return null
  const spec = m[1]!
  if (spec.includes('?')) return [parseInt(spec.replace(/\?/g, '0'), 16), parseInt(spec.replace(/\?/g, 'F'), 16)]
  const lo = parseInt(spec, 16)
  return [lo, m[2] ? parseInt(m[2], 16) : lo]
}

const FULL_RANGE = /^U\+0*-10FFFF$/i

/**
 * True when the face is for Arabic. An explicit unicode-range that includes U+0627 (alef) says so. The default
 * range `U+0-10FFFF` says nothing about glyphs, so a face with it counts only when its family name is an Arabic one.
 */
export function coversArabic(face: LoadedFace): boolean {
  const ranges = face.unicodeRange.split(',').map((t) => t.trim())
  if (ranges.length === 1 && FULL_RANGE.test(ranges[0]!)) return ARABIC_FAMILY_NAME.test(face.family)
  return ranges.some((token) => {
    const r = parseRange(token)
    return r !== null && r[0] <= ARABIC_LETTER_ALEF && ARABIC_LETTER_ALEF <= r[1]
  })
}

/**
 * True when the face declares the code point in an explicit unicode-range. The default range `U+0-10FFFF` says nothing
 * about glyphs, so it never counts: IBM Plex Sans Arabic has it and still draws U+20C3 as a missing-glyph box (test/verify.test.ts).
 */
export function coversCodePoint(face: LoadedFace, cp: number): boolean {
  const ranges = face.unicodeRange.split(',').map((t) => t.trim())
  if (ranges.length === 1 && FULL_RANGE.test(ranges[0]!)) return false
  return ranges.some((token) => {
    const r = parseRange(token)
    return r !== null && r[0] <= cp && cp <= r[1]
  })
}

const facesOf = (family: string, fonts: LoadedFace[]): LoadedFace[] => fonts.filter((f) => same(f.family, family))

/** The first family in the stack with a face that has loaded and covers Arabic, or null. */
export function loadedArabicFace(families: string[], fonts: LoadedFace[]): LoadedFace | null {
  for (const family of families) {
    const face = facesOf(family, fonts).find((f) => f.status === 'loaded' && coversArabic(f))
    if (face) return face
  }
  return null
}

/** The family the browser sets the run in: the first one in its stack that the page declares faces for. Null for system fonts. */
export const webfontFamily = (families: string[], fonts: LoadedFace[]): string | null =>
  families.find((family) => facesOf(family, fonts).length > 0) ?? null

/** Size after the face's size-adjust, which scales glyphs without changing font-size. Judged on the loaded faces that cover Arabic, then by weight. */
export function effectiveSize(run: TextRun, fonts: LoadedFace[]): number {
  const family = webfontFamily(run.font.families, fonts)
  if (family === null) return run.font.size
  const faces = facesOf(family, fonts).filter((f) => f.status === 'loaded' && coversArabic(f))
  const face = faces.find((f) => f.weight[0] <= run.font.weight && run.font.weight <= f.weight[1]) ?? faces[0]
  return face ? run.font.size * face.sizeAdjust : run.font.size
}
