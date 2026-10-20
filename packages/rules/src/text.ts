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
 * first group on the right with or without isolation, so isolating them changes nothing.
 */
export const GROUPED_NUMBER = new RegExp(`(?=[0-9\\u0660-\\u0669\\u06F0-\\u06F9 \\u00A0]*[0-9])${DIGIT}+(?:[ \\u00A0]+${DIGIT}+)+|\\+${DIGIT}`)
/** Emails, URLs and codes such as ORDER-2041. */
export const LATIN_TOKEN = /[\w.+-]+@[\w-]+\.[\w.]{2,}|https?:\/\/\S+|www\.\S+|\b[A-Z]{2,}[-_]?\d{2,}\b/
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
