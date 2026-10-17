const ARABIC_CHAR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const ARABIC_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g
const INDIC_CHARS = /[٠-٩۰-۹]/g
const LATIN_CHARS = /[A-Za-zÀ-ɏ]/g
const RTL_STRONG = /[֐-׿؀-ٟ٪-ۯۺ-ࣿיִ-﷿ﹰ-﻿]/
const LTR_STRONG = /[A-Za-zÀ-ɏ]/
const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]'

export const WESTERN_DIGIT = /[0-9]/
export const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/

/** Digit groups split by spaces, or a leading plus: the shapes the bidi algorithm reorders inside RTL text. */
export const GROUPED_NUMBER = new RegExp(`${DIGIT}+(?:[ \\u00A0]+${DIGIT}+)+|\\+${DIGIT}`)
/** Emails, URLs and codes such as ORDER-2041. */
export const LATIN_TOKEN = /[\w.+-]+@[\w-]+\.[\w.]{2,}|https?:\/\/\S+|www\.\S+|\b[A-Z]{2,}[-_]?\d{2,}\b/
export const ENDS_WITH_PUNCTUATION = /[.!?:;,)\]]\s*$/
export const PLACEHOLDER = /lorem ipsum|dolor sit amet|لوريم إيبسوم|هذا النص هو مثال/i
export const ARABIC_FONT =
  /arab|kufi|naskh|cairo|tajawal|almarai|readex|amiri|vazir|alexandria|rubik|geeza|dubai|lateef|scheherazade|harmattan|lalezar|messiri|changa|mada|zain|janna|noto sans arabic|plex sans arabic|segoe ui|system-ui|-apple-system/i

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

/** The direction a paragraph of this text would take on its own, from its first strong character. */
export function firstStrong(s: string): 'ltr' | 'rtl' | null {
  for (const ch of s) {
    if (RTL_STRONG.test(ch)) return 'rtl'
    if (LTR_STRONG.test(ch)) return 'ltr'
  }
  return null
}

export const excerpt = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max)}…` : s)
