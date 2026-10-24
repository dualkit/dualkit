# Dualkit 3: convert, design systems and build

Agreed with Sam on 24 Oct 2026. This replaces the direction of the [v2 design](2026-10-22-dualkit-v2-design.md) from here on. Nothing built in v2 is thrown away.

## Why

Three weeks of measuring showed that Dualkit catches mistakes well but does not yet make screens people want. Check finds every planted bug, but a bug that never happens is invisible, so nobody sees Dualkit as better than plain AI. The paid judge and the review mode both failed. The one thing that visibly changed pages was the kit, which won 7 of Sam's 10 blind pairs against a bar of 8.

Sam's goal, in his words: Dualkit "builds a clearly better Arabic app every time", and when someone has built a full app in English, in code or in Figma, Dualkit "can convert that entire thing into an Arabic app" and recommend how to make it better for the Arabic format and the region. It also helps build design systems made for the Arabic market.

## The three jobs

1. **Convert.** Turn an existing English app into an Arabic one. Code first, Figma later.
2. **Design systems.** Read a team's existing tokens and components, say what fails in Arabic, and add what is missing, in their brand.
3. **Build.** When someone asks an AI for a new Arabic or bilingual app, the result is clearly better than plain AI every time.

Order: convert code, then the proof app and site, then design systems, then Figma, then build. Each gets its own plan. This document is detailed enough to plan convert code now; the later jobs get a short design of their own when their turn comes.

## Convert code

### What the person does

1. In their repo, they run `npx dualkit convert`, or ask their AI agent to use the Dualkit convert skill, which runs the same command.
2. Dualkit asks one question: **one app that switches between English and Arabic, or a separate Arabic version.** The person decides. `--mode bilingual` or `--mode arabic` skips the question.
3. Dualkit reads the whole app and changes the code on a new git branch. It never touches their main branch and never pushes.
4. The agent, guided by the skill, does the parts that need judgement: Arabic copy and regional suggestions.
5. `dualkit check` runs on every page, in Arabic and, in bilingual mode, in English.
6. They get a report, `dualkit-convert.md`, and review the branch like any pull request.

### What changes in the code

Mechanical changes are done by the `dualkit convert` command itself, with code transforms built on the lint parser that already finds these problems. They are repeatable and need no AI:

- Physical CSS and Tailwind classes become logical (`ml-4` to `ms-4`, `left:` to `inset-inline-start:`, `text-left` to `text-start`).
- `dir` and `lang` are set on the root, driven by the chosen locale.
- Icons that point a direction (arrows, chevrons, back buttons) get a mirror rule. Icons that must not mirror (play, a clock, logos) are left alone, from a list in the rules.
- Numbers, prices and phone numbers in markup are isolated so they never reorder.
- An Arabic font and Arabic type tokens are added: size floor, line height and no letter spacing on Arabic.
- Dates, money and phone formatting are routed through `@dualkit/format` for Gulf formats: dirham with VAT, Saturday-first weeks, Hijri where shown, +971.

Judgement work is done by the person's own agent following the convert skill, so Dualkit makes no model calls and spends nothing:

- Pulling user-facing strings into translation files and drafting the Arabic.
- Regional suggestions it does not apply by itself, for example a name form that splits first and last name, or a payment step with no local methods.

### Bilingual and Arabic-only

- **Bilingual:** strings go into per-locale files, a language switch is added, and English must look exactly as it did before. Logical CSS renders the same as physical CSS in left to right, so a screenshot of every English page before and after must match. If it does not, the conversion has a bug.
- **Arabic only:** the app is converted in place on the conversion branch: Arabic and right to left throughout, with no switch. The English app stays untouched on their main branch. There is no second copy folder, because two copies of one app drift apart and double the upkeep. Anyone who wants English and Arabic both running picks bilingual. (Sam left this to Claude, 24 Oct.)

If the repo already uses a translation library, Dualkit uses it. If not, it adds the standard one for the framework (builder's choice, named in the plan).

### The report

`dualkit-convert.md` lists, in plain words:

- What changed, grouped by kind, with counts and file links.
- Every Arabic string drafted by a model, marked for a native speaker to check. Machine Arabic is never presented as final.
- Regional suggestions, each with why and how to apply it.
- The check results for every page, and the English before and after match in bilingual mode.
- Anything Dualkit could not convert by itself, such as canvas drawing, images with English text baked in, or third-party widgets.

### First version scope

- React and Next.js apps, styled with Tailwind (v3 and v4) or plain CSS and CSS modules. That covers most of what AI tools build.
- Vue, Svelte, React Native and native mobile come later.

## Proof

Convert one well-known open-source English app (MIT or similar licence, React or Next.js, at least 8 screens). Show it on dualkit.dev as a before and after you can click through, linking the conversion branch.

Pass bar, set before we look:

- Sam judges 10 converted screens blind against the same app converted by a plain AI agent given the same request with no Dualkit. Sides are split 5 and 5. Dualkit must win at least 8.
- Check reports no errors on any converted page.
- In bilingual mode, every English page matches its screenshot from before.
- English pages and the app's existing tests still pass.

## Design systems (later, short design first)

`dualkit design-system` reads tokens (DTCG files, Tailwind config or CSS variables) and component source. It reports what fails in Arabic: a font with no Arabic, line height too tight for Arabic, components with left and right hardcoded. It then adds Arabic type tokens, direction rules and the Gulf parts (amount, phone field, list row, Hijri date picker) styled with the team's own tokens. The Starter and the kit from 24 Oct become these parts.

## Figma (later, short design first)

The same rules and parts, applied to a Figma file through the Figma plugin API: mirror auto-layout, swap fonts and type, isolate numbers, and produce an Arabic copy of each frame with the same report. The renderer and bidi lessons from the Starter kit work apply.

## Build (later)

Keep improving the skill and kit until a blind test reaches 8 of 10, with sides balanced. The 24 Oct kit test is the baseline: 7 wins, 1 tie, 2 losses (settings and support chat), with Dualkit on the left in 8 of 10 pairs.

## What happens to what exists

| What exists | Role now |
| --- | --- |
| Rules (29) | The knowledge behind every job |
| `dualkit lint` | Convert's scanner. Its findings become fixes. |
| `@dualkit/format` | The Gulf formats convert wires in |
| `dualkit check` | The proof step on every converted page |
| Skill | Stays for build; a convert skill is added |
| Starter and kit | The parts the design system job restyles |
| Bench | Measures convert as well as build |
| Site | Rewritten around the three jobs, after Figma sign-off |

Retired: the paid judge (stopped 24 Oct) and `dualkit check --review` (found 0 of 65), which is hidden from the docs but kept in code.

## Constraints

- No model calls by Dualkit itself in convert. Judgement work runs on the person's own agent.
- Paid models only from the $10 OpenRouter credit, at most $3 a month, for our own testing.
- Figma sign-off before any site or visual work. Sam approves each job's plan before code.
- Copy in sentence case, plain English, no em dashes.

## Non-goals

- Translating long-form content such as blogs or legal pages well. Strings are drafted and flagged; content is the team's job.
- Frameworks other than React and Next.js in the first version.
- Hosting or running the converted app for anyone.

## Anti-goals

- Shipping machine Arabic as if a native speaker wrote it.
- Changing the English app in bilingual mode in any way a user could see.
- Pushing to, or rewriting, anyone's main branch.
- A conversion that passes check but that an Arabic reader would still not want to use. The blind test exists to catch this.

## Calls from the builder check (all Claude's call)

- **Locale switching in bilingual mode:** Next.js App Router apps get a locale in the URL (`/ar/...`), so server components render the right `dir` and every page has an address check can visit. Other React apps keep the locale in a cookie, read before first paint.
- **Command and agent split on strings:** the command finds user-facing strings, rewrites them to translation calls and writes the English file plus an Arabic file whose entries are marked pending. The agent only fills pending entries. Convert runs in phases (`convert`, then `convert --finish` once strings are filled) and is safe to re-run: a second run changes nothing already converted.
- **Finding pages:** the person gives a start command (asked once, saved in `dualkit.config`). Routes come from the file system router, or from a list the person gives for other React apps. Dynamic and signed-in pages need sample params or a test login in the config. Any page check cannot reach is listed in the report, never silently skipped.
- **English match tolerance:** Chromium, at 390 and 1280 wide, fonts loaded and animations off, with live data frozen where the app allows. A page passes when under 0.1% of pixels differ. Anything above is shown in the report with the diff image.
- **Transform coverage:** classes and properties with a clean logical form are converted (margin, padding, inset, text-align, border sides, rounded corners, `space-x`, `divide-x`, float). Those without one (`translate-x`, `bg-gradient-to-r`, shadow offsets, background position, rotate) are flagged in the report with a suggested fix, not changed. In `cn()` calls and template literals, static class pieces are converted and computed ones are flagged.
- **Which rules become fixers:** only the lint rules behind the mechanical changes listed above. Other rules stay as findings.
- **Repo state:** convert needs a git repo with a clean working tree, and refuses otherwise with a one-line reason. It branches from the current commit.

## Left to the builder

- The code transform library and how changes are applied safely.
- Which translation library to add when none exists, per framework.
- Which open-source app to convert for the proof, within the bar above.
- How the convert skill and the command split the work, as long as Dualkit itself makes no model calls.
