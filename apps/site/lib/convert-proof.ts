// The /convert proof: TailAdmin, an MIT open-source Next.js dashboard, converted by dualkit convert.
// Every number here comes from the real run, recorded in docs/research/2026-10-24-convert-proof.md.

export type ProofScreen = {
  /** File stem under /convert/, shared by en- and ar- shots at both widths. */
  slug: string
  name: string
  /** The English path; the Arabic one is /ar plus it. */
  path: string
  /** dualkit check score of the Arabic page at 1280 wide. */
  score: number
}

export const PROOF_APP = {
  name: 'TailAdmin',
  line: 'a free Next.js admin dashboard with 2,600 stars on GitHub, MIT licensed',
  source: 'https://github.com/TailAdmin/free-nextjs-admin-dashboard',
  branch: 'https://github.com/dualkit/tailadmin-convert/tree/dualkit/bilingual',
  diff: 'https://github.com/dualkit/tailadmin-convert/compare/original...dualkit/bilingual',
} as const

export const PROOF_SCREENS: readonly ProofScreen[] = [
  { slug: 'dashboard', name: 'Dashboard', path: '/', score: 96 },
  { slug: 'profile', name: 'Profile', path: '/profile', score: 96 },
  { slug: 'calendar', name: 'Calendar', path: '/calendar', score: 94 },
  { slug: 'forms', name: 'Form elements', path: '/form-elements', score: 94 },
  { slug: 'tables', name: 'Tables', path: '/basic-tables', score: 96 },
  { slug: 'bar-chart', name: 'Bar chart', path: '/bar-chart', score: 96 },
  { slug: 'line-chart', name: 'Line chart', path: '/line-chart', score: 96 },
  { slug: 'signin', name: 'Sign in', path: '/signin', score: 100 },
]

/** Convert's counts come from its own summary; the agent's from the branch. English shots compared at a channel tolerance of 8. */
export const PROOF_COUNTS = { edits: 679, convertStrings: 310, strings: 464, agentMinutes: 38, englishShots: 16, worstEnglishDiff: '0.008%' } as const

/** Shot sizes in css px. Desktop shots are cropped to one screen; phone shots to two. */
export const SHOT = { desktop: { w: 1280, h: 800 }, phone: { w: 390, h: 844 } } as const

export const shotSrc = (slug: string, lang: 'en' | 'ar', device: 'desktop' | 'phone') =>
  `/convert/${lang}-${slug}-${device === 'desktop' ? 1280 : 390}.webp`
