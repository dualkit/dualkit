// Copy for /convert. Numbers come from lib/convert-proof.ts, never typed in here.

export const CONVERT_COPY = {
  title: 'Convert',
  headline: ['Your English app.', 'Now in Arabic.'],
  lede: 'We ran dualkit convert on TailAdmin, an open-source admin dashboard, and an agent with the dualkit-convert skill finished it. Every screen below is the real result, and the whole change is one branch on GitHub.',
  description: 'Dualkit convert turned TailAdmin, an open-source Next.js dashboard, into a bilingual English and Arabic app. See every screen before and after.',
  diff: 'See the branch',
  docs: 'Read the docs',
  viewerLabel: 'TailAdmin before and after',
  caption: (worst: string) => `Shots taken at 1280 and 390 wide. English differs from the original app by ${worst} of pixels at most. The number next to each screen is its dualkit check score in Arabic, out of 100, with no errors or warnings on any page.`,
  countsLabel: 'What convert did',
  counts: (c: { edits: number; convertStrings: number; strings: number; agentMinutes: number; englishShots: number }): readonly (readonly [string, string])[] => [
    [String(c.edits), 'edits made by convert in 27 seconds'],
    [String(c.strings), `strings in Arabic, ${c.convertStrings} of them found by convert`],
    [`${c.agentMinutes} min`, 'for an agent with the skill to finish the rest'],
    [`${c.englishShots} of ${c.englishShots}`, 'English shots that match the original'],
  ],
  steps: {
    heading: 'Three steps, one branch',
    items: [
      ['Convert', 'Run it in a clean repo. It makes a new branch, swaps left and right for start and end, keeps phone numbers and amounts reading the right way, and moves every English string into a translation file.'],
      ['Fill the Arabic', 'Each string waits in dualkit-strings.json. Your agent fills them with the dualkit-convert skill and fixes the places convert flagged. Every drafted string is marked for a native speaker to check.'],
      ['Finish', 'It compares every English page with a screenshot from before, runs the 34 check rules on every Arabic page, runs your tests and writes a report.'],
    ] as const,
  },
  left: {
    heading: 'What the agent finished',
    lede: 'Convert rewrites only what it can rewrite safely. On TailAdmin the agent did the rest by hand in two commits, and we are moving most of it into convert.',
    items: [
      ['154 more strings', 'Text passed through props, kept in data arrays or set in chart options. Convert 0.1 missed these.'],
      ['Links that keep the language', 'Twelve files used the plain Next.js link, which sends an Arabic visitor back to English. The agent swapped in the locale link.'],
      ['Charts and the calendar', 'Arabic month names, the value axis on the right and Arabic type inside ApexCharts and FullCalendar.'],
      ['The Arabic itself', 'Dualkit makes no model calls. The agent drafted every string, and each one is marked for a native speaker to check.'],
    ] as const,
  },
  credit: {
    before: '',
    after: ' is made by TailAdmin and MIT licensed. The converted app lives on the ',
    branch: 'dualkit/bilingual branch',
  },
} as const
