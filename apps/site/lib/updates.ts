// Every Dualkit release, newest first. Only real releases go here; the RSS feed reads the same list.
export type Release = {
  slug: string; date: string; version: string; tags: string[]; title: string; body: string[]
  shipped: { name: string; line: string }[]
}

export const RELEASES: readonly Release[] = [
  {
    slug: 'v0-1-0-beta-1',
    date: '2026-10-16',
    version: 'v0.1.0-beta.1',
    tags: ['Format', 'Starter', 'Skills'],
    title: 'On npm and shadcn, with Saudi phones and every Gulf currency',
    body: [
      '@dualkit/format and @dualkit/starter now install straight from npm, published from GitHub Actions with signed provenance.',
      'Format reads Saudi mobiles and landlines, and formats all six Gulf currencies. The Kuwaiti and Bahraini dinars and the Omani rial show three decimals, because they split into 1,000 fils or baisa.',
      'The eight Starter components now install one at a time with the shadcn CLI, and the skills install into any agent with npx skills. The Claude Code plugin moved into its own folder, so it carries only the skills.',
    ],
    shipped: [
      { name: '@dualkit/format 0.1.0-beta.1', line: 'parseSaudiPhone, plus QAR, KWD, BHD and OMR in formatMoney, with 117 tests' },
      { name: '@dualkit/starter 0.1.0-beta.0', line: 'The eight bilingual components, now on npm' },
      { name: 'shadcn registry', line: 'npx shadcn@latest add https://dualkit.dev/r/amount.json, for any of the eight' },
      { name: 'npx skills add dualkit/dualkit', line: 'The four skills in Codex, Cursor and any agent that reads skills' },
    ],
  },
  {
    slug: 'v0-1-0-beta',
    date: '2026-10-13',
    version: 'v0.1.0-beta',
    tags: ['Skills', 'Format'],
    title: 'Dualkit goes public with skills and formats',
    body: [
      'The first release ships four agent skills for Claude Code and Cursor, and @dualkit/format, a library for Gulf formats with no dependencies.',
      'Every skill was measured against a baseline before release. Fresh agents built the same checkout screen, and the skills took bidi isolation, Arabic leading and stored capitals from 0 of 3 runs to 3 of 3.',
    ],
    shipped: [
      { name: '@dualkit/format 0.1.0-beta.0', line: 'Money, digits, Hijri, UAE phone, Emirates ID and Gulf IBAN, with 83 tests' },
      { name: 'Four skills', line: 'dualkit-rtl-layout, dualkit-type-pairing, dualkit-gulf-formats and dualkit-bilingual-copy' },
      { name: 'Cursor rules', line: 'Generated from the same source as the skills, with a test that fails when they drift' },
    ],
  },
]

export type RoadmapState = 'In review' | 'In progress' | 'Planned' | 'Needs co-authors'
export type RoadmapItem = { title: string; line: string; state: RoadmapState; steps: readonly (readonly [string, boolean])[] }

// Progress is counted from real milestones, never typed in. Tick a step only when it is true on main.
export const UP_NEXT: readonly RoadmapItem[] = [
  { title: 'Claude plugin directory', line: 'Dualkit listed in the directory inside Claude Code and the Claude apps.', state: 'In review',
    steps: [['Plugin in its own folder', true], ['Submitted', true], ['Approved by Anthropic', false]] },
  { title: 'shadcn directory', line: 'npx shadcn add @dualkit/amount, without the full URL.', state: 'In review',
    steps: [['Registry live on dualkit.dev', true], ['Pull request opened', true], ['Merged by shadcn', false]] },
  { title: 'dualkit check', line: 'Audit any page for RTL bugs and get a shareable Gulf-ready report.', state: 'In progress',
    steps: [['Design', true], ['First 20 rules', false], ['CLI and report', false], ['GitHub Action', false], ['Released', false]] },
  { title: 'Bench', line: 'Free AI models build Arabic screens every month, scored alone and with Dualkit.', state: 'Planned',
    steps: [['Design', true], ['Prompts', false], ['Monthly runner', false], ['Leaderboard page', false], ['First run', false]] },
  { title: 'Gallery, patterns and resources', line: 'Arabic UI done well, the fix for each common bug, and the tools worth using.', state: 'Planned',
    steps: [['Design', true], ['Patterns', false], ['Gallery', false], ['Resources', false], ['Monthly note', false]] },
  { title: 'Figma plugin', line: 'Check a frame, mirror it to Arabic, set the type and fill it with Gulf data.', state: 'Planned',
    steps: [['Design', true], ['Gulf sample data', false], ['Check and mirror', false], ['Type and fill', false], ['On Figma Community', false]] },
  { title: 'Oman IBAN', line: 'OM joins AE, SA, BH, KW and QA in parseIban.', state: 'Planned',
    steps: [['Tests', false], ['Parser', false], ['Released', false]] },
  { title: 'Gulf UI strings', line: 'Reviewed Arabic for buttons, errors and payments, written with native co-authors.', state: 'Needs co-authors',
    steps: [['Co-authors found', false], ['First 100 strings', false], ['Released', false]] },
]

export const progress = (item: RoadmapItem): { done: number; total: number; percent: number } => {
  const done = item.steps.filter(([, ok]) => ok).length
  return { done, total: item.steps.length, percent: Math.round((done / item.steps.length) * 100) }
}

export const displayDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
