// Every Dualkit release, newest first. Only real releases go here; the RSS feed reads the same list.
export type Release = {
  slug: string; date: string; version: string; tags: string[]; title: string; body: string[]
  shipped: { name: string; line: string }[]
}

export const RELEASES: readonly Release[] = [
  {
    slug: 'skills-0-1-1',
    date: '2026-10-19',
    version: 'Plugin 0.1.1',
    tags: ['Skills'],
    title: 'The skills now teach plain CSS first, and every example is tested',
    body: [
      'The four skills lead with plain CSS and HTML attributes, and Tailwind sits in one closing section. The Arabic size floor of 14px is now part of the snippet you copy, and the skills cover punctuation and brackets in right-to-left text.',
      'Every code example in the skills is now rendered in a browser and checked against the 20 rules, so a snippet that breaks a rule fails the tests. We have not re-run the bench since this change, so we are not claiming a new result.',
    ],
    shipped: [
      { name: 'dualkit-rtl-layout', line: 'Plain CSS with :dir(rtl) first, paired transforms, input direction, punctuation and brackets, and Tailwind v4.2 or later last' },
      { name: 'dualkit-type-pairing', line: 'The 14px Arabic floor as size tokens, a real Arabic font stack, and Arabic inside Latin elements' },
      { name: 'dualkit-bilingual-copy', line: 'Helpers that are defined, an explained full stop, and stacked two-language labels' },
      { name: 'dualkit-gulf-formats', line: 'A plain statement of coverage and verified currency signs, with font unicode-range advice' },
    ],
  },
  {
    slug: 'check-v0-1-0-beta',
    date: '2026-10-19',
    version: 'Check v0.1.0-beta',
    tags: ['Check', 'Rules'],
    title: 'Dualkit check: see what breaks in Arabic',
    body: [
      'Point one command at any page, local or live. It opens the page in Chromium, scores it out of 100 and writes a report you can share, with every bug marked on a screenshot.',
      'It runs 20 rules in five families: bidi, layout, icons, type and content. Each finding gets an evidence card with a zoomed crop of the bug and the fix, and a GitHub Action runs the same check on every pull request.',
    ],
    shipped: [
      { name: 'dualkit 0.1.0-beta.0', line: 'npx dualkit check <url> writes the report, prints a summary and can fail CI below a score' },
      { name: '@dualkit/rules 0.1.0-beta.0', line: 'The 20 rules on their own, each documented in RULES.md' },
      { name: 'dualkit/dualkit/action@main', line: 'Scores every pull request, writes the job summary and uploads the report' },
    ],
  },
  {
    slug: 'claude-plugin-directory',
    date: '2026-10-18',
    version: 'Plugin 0.1.0',
    tags: ['Skills'],
    title: 'Listed in the Claude plugin directory',
    body: [
      'The four Dualkit skills now install straight from the Claude plugin directory, inside Claude Code, Cowork and the Claude apps on web, desktop and mobile.',
    ],
    shipped: [
      { name: 'Claude plugin directory', line: 'The four skills, one install away in Claude Code, Cowork and the Claude apps' },
    ],
  },
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

export type RoadmapState = 'Released' | 'In progress' | 'Coming'
export type RoadmapItem = { title: string; line: string; state: RoadmapState; steps: readonly (readonly [string, boolean])[] }

// Progress is counted from real milestones, never typed in. Tick a step only when it is true on main.
export const UP_NEXT: readonly RoadmapItem[] = [
  { title: 'Dualkit check', line: 'Point it at any screen. See what breaks in Arabic.', state: 'Released',
    steps: [['Design', true], ['First 20 rules', true], ['CLI and report', true], ['GitHub Action', true], ['Released', true]] },
  { title: 'The Bench', line: 'How well does AI build Arabic? Find out every month.', state: 'Coming',
    steps: [['Design', true], ['Prompts', false], ['Monthly runner', false], ['Leaderboard page', false], ['First run', false]] },
  { title: 'Dualkit for Figma', line: 'Everything Dualkit knows, inside Figma.', state: 'Coming',
    steps: [['Design', true], ['Gulf sample data', false], ['Check and mirror', false], ['Type and fill', false], ['On Figma Community', false]] },
  { title: 'A home for Gulf designers', line: 'Inspiration, patterns and resources, in one place.', state: 'Coming',
    steps: [['Design', true], ['Patterns', false], ['Gallery', false], ['Resources', false], ['Monthly note', false]] },
  { title: 'More of the Gulf', line: 'More countries, more formats.', state: 'Coming',
    steps: [['Tests', false], ['Parser', false], ['Released', false]] },
  { title: 'Arabic, written with you', line: 'Native Arabic designers, credited by name. Want in?', state: 'Coming',
    steps: [['Co-authors found', false], ['First 100 strings', false], ['Released', false]] },
]

export const progress = (item: RoadmapItem): { done: number; total: number; percent: number } => {
  const done = item.steps.filter(([, ok]) => ok).length
  return { done, total: item.steps.length, percent: Math.round((done / item.steps.length) * 100) }
}

export const displayDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
