// Every Dualkit release, newest first. Only real releases go here; the RSS feed reads the same list.
export type Release = {
  slug: string; date: string; version: string; tags: string[]; title: string; body: string[]
  shipped: { name: string; line: string }[]
}

export const RELEASES: readonly Release[] = [
  {
    slug: 'lint-0-1-0',
    date: '2026-10-20',
    version: 'dualkit 0.3.0-beta.0',
    tags: ['Check'],
    title: 'Dualkit lint reads your source',
    body: [
      'Dualkit lint checks your CSS, HTML, JavaScript and TypeScript files for Arabic and right-to-left bugs before anything renders. It needs no browser, so it runs in seconds on a laptop or in CI. Run npx dualkit@beta lint . in your project, or set mode: lint in the GitHub Action.',
      'It ships with 8 source rules. Left and right in CSS where a logical property would follow the reading direction. Physical Tailwind classes such as ml-4 or text-left. Letter-spacing on Arabic text. A [dir] attribute selector where :dir() would also catch inherited direction. Arabic number and date formats that leave the digits to the runtime. The bare islamic calendar where the Gulf uses islamic-umalqura. A Hijri date with no time zone. The old rial sign used as the Saudi riyal sign.',
      'Some things are left alone on purpose. A matching pair of sides, such as ml-2 mr-2 or left: 0 with right: 0, looks the same in both directions. So does the centring idiom, left: 50% with a 50% translate. Classes under an rtl: or ltr: variant, and CSS under a direction-scoped selector such as :dir(rtl), are already handled. The full list is under Known limits in LINT.md.',
      'Tailwind fixes follow the version you have installed. Lint reads it from the nearest package.json, so a project on Tailwind 3.4 is told to use start-0, and one on 4.2 is told inset-s-0.',
      'We ran it on this repo first. It found 14 places on dualkit.dev that were tied to left to right, such as a divider on the left edge, and we fixed them. The rest were demos and test fixtures that keep their bugs on purpose.',
    ],
    shipped: [
      { name: '@dualkit/lint 0.1.0-beta.0', line: '8 source rules, lint() and lintText() for your own tools, and LINT.md' },
      { name: 'dualkit 0.3.0-beta.0', line: 'npx dualkit lint runs the 8 rules, and the GitHub Action takes mode: lint' },
    ],
  },
  {
    slug: 'rules-0-2-0',
    date: '2026-10-20',
    version: '@dualkit/rules 0.2.0-beta.0',
    tags: ['Check'],
    title: 'Nine new rules in Dualkit check',
    body: [
      'Dualkit check now runs 29 rules, up from 20. Every new rule was tested against what Chromium paints before it shipped.',
      'Content gets four: the old rial ligature used as a riyal sign, a new currency sign that no loaded font draws, the dirham sign written next to AED, and a label in a different language from its element. Bidi gets a check for an Arabic placeholder in a left-to-right field. Layout gets text flipped with scaleX(-1) and text cut off by a fixed box. Type gets Arabic words split by an inline-block or inline-flex box, and Arabic bold that the browser fakes.',
      'Some candidates did not make it. Groups of Arabic-Indic digits paint the same with or without bdi, so they are not flagged. Plain emails, links and order codes paint the same too, so only a leading #, a trailing slash or a Western digit beside them is flagged. A closing mark in the middle of a line, such as the exclamation mark in an English phrase that comes before Arabic, is not checked, and neither is an email or code that sits beside a Latin word.',
      'We also narrowed a few claims. Only the dirham sign beside AED is flagged, not Dh or the Arabic word. A label is flagged only when it is wholly in the other script. Ink that sticks out of a box that still fits its line is not measured. A font change inside an Arabic word is flagged only when the page shows its letters painted apart, since some fonts keep the join and others do not. The full list is under Known limits in RULES.md.',
      'One change can lower your score when you upgrade. type/arabic-font now fails stacks that start with a Latin system font, such as system-ui, Segoe UI and Tailwind\'s default sans, until you add an Arabic font to them.',
    ],
    shipped: [
      { name: '@dualkit/rules 0.2.0-beta.0', line: '29 rules, nine of them new, with the known limits listed in RULES.md' },
      { name: 'dualkit 0.2.0-beta.0', line: 'npx dualkit check <url> runs the 29 rules' },
    ],
  },
  {
    slug: 'format-0-2-0',
    date: '2026-10-20',
    version: '@dualkit/format 0.2.0-beta.0',
    tags: ['Format', 'Skills'],
    title: 'Phones and IBANs for all six GCC countries',
    body: [
      'Format now reads phone numbers from Qatar, Kuwait, Bahrain and Oman, next to the UAE and Saudi Arabia. parseGulfPhone reads a number from any of the six, as long as it starts with a + or 00 and the country code.',
      'IBAN checks now cover Oman. There is also a Saudi VAT number parser, a weekend table for every country with the Sharjah government week, and currencySign for the three new Unicode signs.',
      'One breaking change: toHijri and formatHijri now need a timeZone. It was optional before, and leaving it out could show the wrong day.',
    ],
    shipped: [
      { name: '@dualkit/format 0.2.0-beta.0', line: 'Phones for QA, KW, BH and OM, parseGulfPhone, Omani IBANs, parseSaudiVatNumber, gulfWeek, isGulfWeekend and currencySign' },
      { name: '@dualkit/starter 0.1.0-beta.1', line: 'Works with format 0.2' },
      { name: 'Plugin 0.1.2', line: 'The gulf-formats skill now states the new coverage and its weekend facts match gulfWeek' },
    ],
  },
  {
    slug: 'a-new-dualkit-dev',
    date: '2026-10-19',
    version: 'Site',
    tags: ['Site'],
    title: 'A new dualkit.dev',
    body: [
      'The site has a new design. The home page opens on a painting of a Gulf dusk with a bilingual checkout on it, and steps through what each part of the kit fixes.',
      'Skills, Format, Starter, Check and the Bench each get a preview before you install anything, and the Slide to pay control flips between left to right and right to left.',
    ],
    shipped: [
      { name: 'dualkit.dev', line: 'A new home page, with a preview of each part of the kit' },
    ],
  },
  {
    slug: 'skills-0-1-1',
    date: '2026-10-19',
    version: 'Plugin 0.1.1',
    tags: ['Skills'],
    title: 'The skills now teach plain CSS first, and their examples are tested',
    body: [
      'The four skills lead with plain CSS and HTML attributes, and Tailwind sits in one closing section. The Arabic size floor of 14px is now part of the snippet you copy, and the skills cover punctuation and brackets in right-to-left text.',
      'Every HTML and CSS example in the skills is now rendered in a browser and checked against the 20 rules, so a snippet that breaks a rule fails the tests. We have not re-run the bench since this change, so we are not claiming a new result.',
    ],
    shipped: [
      { name: 'dualkit-rtl-layout', line: 'Plain CSS with :dir(rtl) first, paired transforms, input direction, punctuation and brackets, and Tailwind last' },
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
  { title: 'Dualkit lint', line: 'Catch Arabic and right-to-left bugs in your source.', state: 'Released',
    steps: [['Design', true], ['8 source rules', true], ['CLI and Action', true], ['Released', true]] },
  { title: 'The Bench', line: 'How well does AI build Arabic? Find out every month.', state: 'In progress',
    steps: [['Design', true], ['Prompts', true], ['Monthly runner', true], ['Leaderboard page', true], ['First run', false]] },
  { title: 'Dualkit for Figma', line: 'Everything Dualkit knows, inside Figma.', state: 'Coming',
    steps: [['Design', true], ['Gulf sample data', false], ['Check and mirror', false], ['Type and fill', false], ['On Figma Community', false]] },
  { title: 'A home for Gulf designers', line: 'Inspiration, patterns and resources, in one place.', state: 'Coming',
    steps: [['Design', true], ['Patterns', false], ['Gallery', false], ['Resources', false], ['Monthly note', false]] },
  { title: 'More of the Gulf', line: 'More countries, more formats.', state: 'Released',
    steps: [['Tests', true], ['Parser', true], ['Released', true]] },
  { title: 'Arabic, written with you', line: 'Native Arabic designers, credited by name. Want in?', state: 'Coming',
    steps: [['Co-authors found', false], ['First 100 strings', false], ['Released', false]] },
]

export const progress = (item: RoadmapItem): { done: number; total: number; percent: number } => {
  const done = item.steps.filter(([, ok]) => ok).length
  return { done, total: item.steps.length, percent: Math.round((done / item.steps.length) * 100) }
}

export const displayDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
