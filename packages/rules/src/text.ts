const ARABIC_CHAR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const ARABIC_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g
const INDIC_CHARS = /[٠-٩۰-۹]/g
const LATIN_CHARS = /[A-Za-zÀ-ɏ]/g
const RTL_STRONG = /[֐-׿؀-ٟ٪-ۯۺ-ࣿיִ-﷿ﹰ-﻿]/
const LTR_STRONG = /[A-Za-zÀ-ɏ]/
const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]'

export const WESTERN_DIGIT = /[0-9]/
export const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/

/**
 * Digit groups split by spaces with at least one Western digit, or a leading plus: the shapes the bidi
 * algorithm reorders inside RTL text. Groups of Arabic-Indic digits alone are left out: Chromium paints them
 * first group on the right with or without isolation, so isolating them changes nothing. Re-measured with three
 * groups (رقم ٠٥٠ ١٢٣ ٤٥٦٧), with and without <bdi>: both paint ٤٥٦٧ ١٢٣ ٠٥٠ from left to right. See verify.test.ts.
 */
export const GROUPED_NUMBER = new RegExp(`(?=[0-9\\u0660-\\u0669\\u06F0-\\u06F9 \\u00A0]*[0-9])${DIGIT}+(?:[ \\u00A0]+${DIGIT}+)+|\\+${DIGIT}`)
/**
 * The shapes the Latin rule looks at: emails, URLs, codes such as ORDER-2041 and INV_2041, and hash tags and codes such as #A-10293.
 *
 * A shape alone is not enough. Measured in Chromium, bare against <bdi>, in 21 positions inside an Arabic paragraph
 * (verify.test.ts, "bidi/unisolated-latin"): the punctuation inside an email, link or code never moves, so isolation
 * changes nothing in mid-sentence, at either end of the block, or before a full stop or bracket. It changes the paint when:
 *   1. the token starts with # (the # lands on the wrong side),
 *   2. a link ends in a slash (the slash lands on the wrong side),
 *   3. a Western digit follows the token across spaces or marks only (the digit joins the token and reads before it),
 *   4. a digit directly precedes the token.
 * A neighbouring Latin word also changes the paint, but only by joining one left-to-right phrase, which reads in order, so it is not a scramble.
 * `scrambledLatinTokens` applies these conditions.
 */
export const LATIN_TOKEN = /#[A-Za-z][\w-]*|[\w.+-]+@[\w-]+\.[\w.]{2,}|https?:\/\/\S+|www\.\S+|(?<![A-Za-z])[A-Z]{2,}[-_]?\d{2,}\b/

const TRAILING_MARKS = /[.,;:!?)\]}'"\u060C\u061B\u061F\u06D4]+$/
const EN_DIGIT = '0-9\\u06F0-\\u06F9'
const AFTER_EN_DIGIT = new RegExp(`^[^\\p{L}\\p{N}]*[${EN_DIGIT}]`, 'u')
/** A digit that the token pattern swallowed, as in 5ORDER-2041: it still sits directly against the token. */
const START_DIGIT = /^[0-9]/
const ANY_DIGIT_BEFORE = /[0-9\u0660-\u0669\u06F0-\u06F9]$/

/**
 * What touches a piece of a run on each side, read from the block so neighbours in other elements count.
 * The run is located in the block by its text, taking the first match. Two runs with identical text in one block
 * (say two "5" digits) both read the first one's surroundings: a known limit, since the model has no run offset.
 * The block copy is capped, so a run that is not found there falls back to its own text.
 */
function surroundings(at: number, length: number, text: string, blockText: string): { before: string; after: string } {
  const base = blockText.indexOf(text)
  const [source, start] = base === -1 ? [text, at] : [blockText, base + at]
  return { before: source.slice(0, start), after: source.slice(start + length) }
}

/** The emails, links and codes in a run that Chromium paints differently once isolated, from the cases listed on LATIN_TOKEN. */
export function scrambledLatinTokens(text: string, blockText: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(new RegExp(LATIN_TOKEN.source, 'g'))) {
    const token = match[0].replace(TRAILING_MARKS, '')
    if (token.length < 3) continue
    const hash = token.startsWith('#')
    const slash = token.endsWith('/')
    const { before, after } = surroundings(match.index ?? 0, token.length, text, blockText)
    if (hash || slash || AFTER_EN_DIGIT.test(after) || ANY_DIGIT_BEFORE.test(before) || START_DIGIT.test(token)) found.push(token)
  }
  return found
}

const HASH_NUMBER = /#(?:([\u0660-\u0669])|[0-9\u06F0-\u06F9])/g

/**
 * A # directly before digits. Measured in Chromium (verify.test.ts, "bidi/unisolated-number and a leading #"): with Arabic-Indic
 * digits the # always lands on the wrong side. With Western digits it does when a letter comes before it on the line:
 * after Arabic it is a scramble (even with a digit group or bracket between); after a Latin word it only joins that word's
 * left-to-right phrase, and with nothing before it, or only brackets, quotes or full stops, it paints the same. Only this run's own
 * matches count, read in their place in the block.
 */
export function hashNumberScrambles(text: string, blockText: string): boolean {
  for (const m of text.matchAll(HASH_NUMBER)) {
    if (m[1] !== undefined) return true
    if (lastStrong(surroundings(m.index ?? 0, 1, text, blockText).before) === 'rtl') return true
  }
  return false
}

/** Closing marks the bidi algorithm treats as neutral, so they land at the paragraph's far end. U+060C is the Arabic comma. */
export const ENDS_WITH_PUNCTUATION = /[.!?:;,)\]\u060C]\s*$/
/**
 * The Arabic semicolon, question mark and full stop are strong right-to-left characters, not neutrals.
 * Measured in Chromium: in a left-to-right block they stay beside Arabic text before them; after a Latin
 * word, or anywhere in a right-to-left block, they land at the block's far end like a full stop.
 */
export const ENDS_WITH_ARABIC_MARK = /[\u061B\u061F\u06D4]\s*$/
export const PLACEHOLDER = /lorem ipsum|dolor sit amet|لوريم إيبسوم|هذا النص هو مثال/i
/** Family names that say the font is for Arabic. Latin-first system fonts and the generics system-ui and -apple-system are not here: they leave Arabic to per-device fallback. */
export const ARABIC_FAMILY_NAME =
  /arab|kufi|naskh|cairo|tajawal|almarai|readex|amiri|vazir|alexandria|rubik|geeza|dubai|lateef|scheherazade|harmattan|lalezar|messiri|changa|mada|zain|janna/i

/**
 * Arabic families that ship with an operating system, from docs/research/2026-10-20-rules-facts.md.
 * These only ever make a stack pass. A rule must never fire because a name is missing from this list.
 */
export const SYSTEM_ARABIC_FONTS: readonly string[] = [
  'Geeza Pro', 'SF Arabic', 'Al Bayan', 'Baghdad', 'Damascus', 'Al Nile', 'Al Tarikh', 'Diwan Kufi', 'Farah', 'KufiStandardGK',
  'Mishafi', 'Muna', 'Nadeem', 'Sana', 'Waseem', 'Noto Naskh Arabic', 'Noto Naskh Arabic UI', 'Noto Sans Arabic UI',
  'Aldhabi', 'Andalus', 'Arabic Typesetting', 'Sakkal Majalla', 'Simplified Arabic', 'Traditional Arabic',
]

export const isSystemArabicFont = (family: string): boolean => SYSTEM_ARABIC_FONTS.some((f) => f.toLowerCase() === family.toLowerCase())

/** Languages written in the Arabic script, matched as a whole subtag so 'art' is not Arabic. */
const ARABIC_SCRIPT_LANG = /^(ar|fa|ur|ps|ku|ckb|sd|ug)(-|$)/i

export const isArabicScriptLang = (lang: string | null): boolean => lang !== null && ARABIC_SCRIPT_LANG.test(lang)

/** Words that contain at least one Arabic letter. */
export const arabicWordCount = (s: string): number => s.split(/\s+/).filter(hasArabic).length

export const hasArabic = (s: string): boolean => {
  const letters = (s.match(ARABIC_CHARS) ?? []).length - (s.match(INDIC_CHARS) ?? []).length
  return letters > 0 && ARABIC_CHAR.test(s)
}

/** Arabic letters as a share of all letters, ignoring digits, spaces and punctuation. */
export function arabicShare(s: string): number {
  const arabic = (s.match(ARABIC_CHARS) ?? []).length - (s.match(INDIC_CHARS) ?? []).length
  const latin = (s.match(LATIN_CHARS) ?? []).length
  return arabic + latin === 0 ? 0 : arabic / (arabic + latin)
}

/** The direction of the last strong character, so the run a closing mark would join. */
export const lastStrong = (s: string): 'ltr' | 'rtl' | null => firstStrong([...s].reverse().join(''))

/** The direction a paragraph of this text would take on its own, from its first strong character. */
export function firstStrong(s: string): 'ltr' | 'rtl' | null {
  for (const ch of s) {
    if (RTL_STRONG.test(ch)) return 'rtl'
    if (LTR_STRONG.test(ch)) return 'ltr'
  }
  return null
}

export const excerpt = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max)}…` : s)
