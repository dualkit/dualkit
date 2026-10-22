# Dualkit v2: rules, reviewer and kit: design

Status: approved by Sam on 22 Oct 2026 ("go"). Sam asked for this after test 2: "it needs to be WAY better", then "less errors, less misses, does more than the basic AI tool, anyone can see the Dualkit version is the better Arabic app", and on the plan: "yes, and ofc, include the new git tools mentioned in the plan". Calls marked "Claude's call" are mine and open to change.

## Why

Test 2 showed the check loop clears what the checker flags. Failed rules fell from 22 to 1 (Gemini Flash Lite) and from 23 to 0 (MiniMax). But in 30 blind before and after pairs, 26 looked the same. Dualkit fixes what a machine can count, and a person cannot see the difference. Three gaps cause that:

1. **Errors.** Lint is right 34% of the time and check 80%. People stop reading a tool that is wrong a third of the time.
2. **Misses.** The rules only see what they were written for. In the by-eye pairs, the one fix that made a page worse garbled the order of a date, and no rule noticed.
3. **Nothing extra.** The skills tell a model what to avoid. They do not hand it anything better to build with, so the page looks like any AI page with fewer bugs.

v2 closes all three, and changes the Bench headline from a rule count to something a person can see.

## Pass bars, set before we look

Each bar is measured before any v2 code ships, so the baseline is on record.

- **Fewer errors:** at least 90% of what Dualkit reports is a real bug, for check, lint and the reviewer, on hand-labelled samples. Today: lint 34%, check 80%.
- **Fewer misses:** Dualkit finds at least 90% of the bugs in a labelled miss set (below). Today's figure is measured first.
- **Visibly better:** with Dualkit, the page wins at least 80% of blind side-by-sides against the same model alone, across the Bench screens and models.
- **Trustworthy judge:** the vision judge agrees with Sam on at least 80% of 20 pairs he judges blind, before any judge number goes on the site.
- **No harm:** the Bench rule counts are no worse than in October.

If a bar is missed, the report says so and that part ships off by default.

## The tools we take from, and how

| Repo | Licence | What we take | How |
|---|---|---|---|
| [alibaba/open-code-review](https://github.com/alibaba/open-code-review) | Apache-2.0 | The design: fixed rules first, then an AI reviewer that only gets the rules that fit, then a reflection pass that checks each finding before it is shown, then a positioning step that pins it to a line. Its benchmark method (labelled real issues, precision, recall, F1). | We copy the design in TypeScript, not the code. We ship a Dualkit rule pack and an MCP server that its review agent can call. |
| [shadcn/ui](https://ui.shadcn.com) | MIT | Right-to-left support and the registry format. | `@dualkit/starter` components are published as a shadcn registry, so `npx shadcn add` installs them. |
| [Tencent ArtifactsBenchmark](https://github.com/Tencent-Hunyuan/ArtifactsBenchmark) | CC BY 4.0 | The judge method: render the page, screenshot it, score it against a checklist written for that task. | We write Arabic checklists per Bench screen and credit them on /bench and in the README. |
| [UI-Bench](https://www.emergentmind.com/topics/ui-bench) | Paper | Pairwise human judgment as the reference a judge must match. | Method only, for Sam's 20 pairs. |

Not used: Noor UI. I found no public repo or licence. The arabic-ui skill on skills.sh is a competitor to measure against, not a source.

Open-code-review says its recall is lower than a general agent's. It chose fewer false alarms over catching everything. So it is the model for "fewer errors". Fewer misses comes from the miss set and the reviewer's checklist below, not from copying it.

## Part 1: measure first (`packages/eval`)

A new package that scores Dualkit itself.

- **Precision set:** every finding labelled in the 20 Oct sweep and the 21 Oct rerun, with its label. Claude's call: reuse them, since they cost hours to make.
- **Miss set:** good pages with one known Arabic bug added each, plus every real miss found by eye so far. Bugs to add: garbled date order, a back arrow pointing the wrong way, an OTP field that drops Arabic-Indic digits, a currency on the wrong side, a cut-off Arabic label, mixed English and Arabic punctuation in the wrong place, letter-spacing on Arabic, a number not isolated in a sentence. At least 60 cases. Claude's call on the size: enough that one miss moves recall by under 2 points.
- **Report:** precision, recall and F1 per tool and per rule, in the open-code-review format, written to `docs/research/`.

## Part 2: fewer errors and misses

1. **Fix what the numbers show.** Lint's physical-css rule and anything else under 90% gets fixed, made a note, or turned off. A new check rule catches garbled date order.
2. **`dualkit review`:** the reviewer. Built the open-code-review way:
   - It runs check and lint first. Those findings are certain and are never re-judged.
   - It looks at what the page contains (dates, money, tables, forms, chat, icons, numbers in text) and picks only the review rules that fit. That keeps the model focused.
   - A vision model looks at the screenshot and the source against those rules. It reports what fixed rules cannot see: text that reads wrong, layout that only looks wrong in Arabic, icons that mean the wrong thing mirrored, Arabic that reads like a translation.
   - A reflection pass checks each finding against a crop of the screenshot and the source, and drops what it cannot confirm.
   - Each finding gets an element and a line, in the same format as check, marked `source: review` with a confidence.
3. **Two ways to run it.** Claude's call: inside Claude Code, Cursor or Codex, the agent you already pay for does the looking. Dualkit hands it the screenshot, the matched rules and the source, like open-code-review's delegate mode, so no key is needed. In CI and the Bench it calls a model through OpenRouter or Gemini.
4. **`@dualkit/mcp`:** an MCP server with check, lint, review and format as tools. It serves Claude Code, Cursor and open-code-review's agent.
5. **open-code-review rule pack:** Dualkit's rules in its review-rule format, matched to `.tsx`, `.vue`, `.html` and `.css`, plus a short guide. It is published from our repo and offered upstream as a pull request only after Sam says yes.

## Part 3: does more than a plain AI (the kit)

1. **Grow `@dualkit/starter`** from 8 to about 16 components, chosen from what the Bench screens need and plain AI gets wrong: a data table with numbers aligned right, a chat bubble with mixed English and Arabic, a phone field, a booking date picker with Hijri, a mirrored toggle, a checkout summary, a list row with chevrons, an empty state. Each is drawn in Figma and signed off by Sam before code.
2. **Publish it as a shadcn registry** at dualkit.dev, so a team or an agent adds components with one command.
3. **Plain HTML too.** The Bench and many agents build single HTML files. Each component also ships as an HTML and CSS pattern, built from the same tokens.
4. **Rewrite the skills** to build with the kit: Arabic type scale, fonts, tokens and components first, then the list of what to avoid. This replaces roadmap project 4 and includes its fixes (the Umm al-Qura "official" claim and the rest of the gap map).

## Part 4: anyone can see it (the judge)

1. **Checklists:** for each Bench screen, 8 to 12 points a person checks in an Arabic app. For example: does the date read in Arabic order, do the arrows point the right way, is the Arabic easy to read at this size, does the amount read correctly.
2. **Pairwise judge:** a vision model sees two screenshots (alone and with Dualkit), unlabelled and in random order, and picks the better Arabic app with the checklist in front of it. Each pair is judged twice, swapped, and only an answer that holds both ways counts.
3. **Calibration:** Sam judges 20 pairs blind first. The judge goes on the site only if it agrees on at least 16.
4. **Bench headline:** "Dualkit wins N of M blind side-by-sides", with the screenshots one click away. Rule counts move below it. The page change waits for Figma sign-off.

## Order

1. Part 1, and the baselines on record.
2. Part 2 steps 1 and 2: precision fixes, the date rule, the reviewer.
3. Part 4 judge and calibration, then a Bench rerun with v1 to get the visible baseline.
4. Part 3: kit in Figma, then code, registry and skills rewrite.
5. Part 2 steps 3 to 5: delegate mode, MCP, the open-code-review pack.
6. Bench rerun with v2, against all bars. Then releases, with every release surface updated.

Each step is its own plan and pull request.

## Non-goals

- No fork of open-code-review, and no Go in the repo.
- No change to how past Bench months were scored. The judge is a new column.
- No paid model calls past the $3 monthly cap, and no new spend beyond the $10 credit without Sam's yes.
- Not React only. Anything the kit does also works in plain HTML.

## Anti-goals

- A reviewer that adds noise. Below 90% it ships off by default.
- A judge that flatters Dualkit. It is blind, swapped, and checked against Sam.
- A kit that looks like every other AI page with Arabic text in it.
- Posting anything upstream or in public before Sam says yes.

## Calls from the builder check (all Claude's call)

- **What counts as a real bug:** something an Arabic reader would see as wrong, the same test used in the 20 Oct sweep. Claude labels, and Sam spot-checks 20 labels per set.
- **Miss set source:** Bench pages from October that check passes cleanly. Each bug is added by a small scripted edit, so it is exact and repeatable. Real misses found by eye are added as they are.
- **Off by default:** a rule under 90% becomes a note, so it is listed but fails nothing. The reviewer runs only with `--review`. Rule changes ship as a minor version with a changelog line, so v1 users see why their CI result changed.
- **Delegate mode:** an MCP tool `review_prepare` returns the screenshot, the crops, the matched rules, the source excerpt and the finding schema. The host agent answers through `review_submit`, which validates the findings, pins them to elements and lines, and sends the reflection step back the same way.
- **Kit sign-off:** Figma in batches of 4 components, one page per batch. The current 8 stay as they are unless a Bench screen shows a gap.
- **Judge verdict:** the judge scores each checklist point for both pages, then picks. A holistic pick only breaks ties. Claude writes the checklists, and Sam approves them with the calibration pairs.
- **Calibration pairs:** Sam's 20 blind pairs are drawn from real Bench pairs, so they test the judge on the work it will do.
- **Bench scope:** all 10 screens and every model with data. The v1 visible baseline reuses the stored October pages, so there is no model drift and no new build calls.
- **Model budget (Sam, 22 Oct: "sure, but i already paid 10$ for openrouter"):** the judge and the reviewer may use a paid vision model, paid from the $10 OpenRouter credit Sam already bought. No new spend. The bench stops paid calls at $3 a month, so the credit lasts at least three months, and every run logs what it spent. Free models stay first wherever they pass calibration. Before the first paid call, check that spending credit keeps the 1,000 free requests a day.
- **Where things live:** `packages/eval` (private, not published), `packages/mcp` as `@dualkit/mcp`, and the open-code-review pack in `packages/rules/ocr`. Each is versioned on its own, like the other packages.

## Left to the builder

The review rule format, how page features are detected, the crop size for reflection, prompt wording, the registry file layout, how the miss set bugs are injected, and which vision model judges, provided it passes calibration.
