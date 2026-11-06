# Dualkit, the Gulf layer

Agreed with Sam on 6 Nov 2026, after four research passes (competitors, pain points, an internal audit, distribution). The goal for the next three months is reach: more developers and more designers using Dualkit.

## Why the direction changed

- RTL layout is now handled by other tools. shadcn ships `init --rtl` and `migrate rtl` (January 2026), Tailwind v4 uses logical properties, and at least eight free RTL skills exist. Mirroring alone is no longer a gap Dualkit can own.
- Government systems already own the public sector. `@aegov` (UAE) gets about 3,000 npm installs a week; Saudi DGA Platforms Code comes with certification. Private-sector teams have no official system.
- Ritla (ritla.app) is a direct, mostly paid rival with 164 components, a Figma library, a scanner and an MCP server.
- What only Dualkit has: `@dualkit/format` (GCC IDs, VAT, IBANs, three-decimal currencies, Umm al-Qura dates) and `dualkit convert`.
- Designers get nothing today. There is no Figma tool or kit, and `/gallery`, `/patterns` and `/resources` return 404.
- Reach is small: 6 stars, about 1.6K npm downloads a month, 10 starter downloads a week.

**Decision:** Dualkit is the Gulf correctness layer that plugs into what teams already use (shadcn, the government systems, agents, Figma). It does not try to be a whole design system.

## Architecture

There is one source of truth: `@dualkit/format` for parsing and validation, and `@dualkit/rules` for checks. Every new surface calls those two and adds no logic of its own.

## 1. Gulf components in the shadcn registry

- A new `gulf-*` namespace, separate from the frozen starter items, which keep their `--dk-*` variables.
- These items use only shadcn variables and primitives (`Input`, `Label`, `Popover`) and logical classes only, so they work with and without `shadcn init --rtl`.
- First set:
  - `gulf-phone-input`: six GCC countries, Arabic-digit input, E.164 output, isolated inside Arabic text.
  - `gulf-iban-input`: groups the IBAN as you type and validates per country.
  - `gulf-national-id-input`: Emirates ID now. Saudi ID and Iqama only once format has a tested validator.
  - `gulf-amount`: three-decimal currencies, sign placement, numeral choice.
  - `gulf-hijri-date`: Gregorian and Hijri side by side, with the time zone required.
- Contract: a controlled `value` and `onChange`, plus the parsed result from format. Labels come in as props with no hardcoded Arabic, because co-authors own the copy.
- Each component gets a page with live Arabic and English demos.

## 2. `@dualkit/mcp`

A stdio MCP server, installed with `npx @dualkit/mcp`. It has four tools:

- `format`: money, Hijri dates, numerals and phones.
- `validate`: IBAN, Emirates ID, VAT and phones. It returns format's `{ ok, value | error }` unchanged.
- `rules`: lists the rules or looks one up by id, with the fix sentence and the pattern link.
- `check_html`: runs the rules on an HTML string with jsdom. It needs no browser. Checking a URL stays in the CLI.

Every input is checked with a zod schema. Errors are plain sentences, never stack traces.

## 3. Figma plugin v0

- **Check frame:** turns the selected frame's text layers into the screen model the rules already read, then runs the type, bidi and content rules. Clicking a finding selects its layer. Rules that need CSS are listed as "not checked in Figma" rather than left out silently.
- **Fill Gulf samples:** replaces placeholder text with valid data (phones, IBANs and Emirates IDs that pass format, amounts, and dates in both calendars). Arabic names wait until a co-author checks them.
- The rules are bundled with esbuild, and the plugin has no network access. Sam publishes it to Figma Community.

## 4. Housekeeping

- A root `pretest` script builds packages in CI order, so `npm test` passes on a fresh checkout.
- **Hijri audit:** compare `toHijri` with the official Umm al-Qura table for 1440–1470 AH. Correct any month where they differ, with a test for each month and the source cited. The site makes no claim about this until the data is in.
- The README line on the native reviewer contradicts issue #6. Sam confirms which is true.

## Testing

- Tests are written first, with 80% coverage on new code and a clean typecheck.
- Components get axe checks and render tests in RTL with Arabic digits.
- The MCP server is tested through an in-memory client with valid and invalid input.
- The Figma adapter is tested on fixture node trees.
- No rule changes, so precision does not move.

## Not in scope, next set

Mobile (React Native, Flutter), RTL chart rules, mapping checks to government standards, lint precision (34%, against a 90% bar), and Context7 and skills.sh listings.
