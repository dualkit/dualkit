# The Bench: design

Agreed with Sam on 19 Oct 2026. Expands section 3 of `2026-10-16-next-level-design.md`.

## Purpose

Show, every month and in public, how well free AI models build Arabic screens on their own and how much the Dualkit skills improve them. Success is a /bench page anyone can check: every number traces back to a committed raw output, and nothing is guessed.

## Decisions

- **Rate limits:** Sam buys $10 of OpenRouter credit once. The free-model cap rises from 50 to 1,000 requests a day, so a monthly run finishes in one go. Models stay free (`:free` ids); the credit is not spent.
- **Automation:** a GitHub Actions schedule, no n8n. 04:17 UTC on the 1st of each month, plus a manual run. The monthly results commit also keeps the scheduled workflow from being disabled for inactivity.
- **Models:** a fixed list in `models.json`, changed by hand. A retired model shows "didn't run this month"; a replacement is marked new on the page.
- **Headline number:** rules passed out of 20, with the 0 to 100 check score beside it.
- **Prompts:** written in English, each asking for one self-contained Arabic HTML file for a Gulf app.
- **Skills loaded** means the four `plugin/skills/*/SKILL.md` files in the system prompt, in a fixed order.
- **Page design:** Figma frames for Sam's sign-off before any page code.

## 1. Runner

A private workspace, `packages/bench` (not published).

- `prompts/<screen>.md` for the five screens: `payment-summary`, `otp`, `address-form`, `profile`, `order-history`. Each prompt has front matter listing its required parts (see section 2).
- `models.json`: `{ id, provider: "openrouter" | "gemini", model, label, since }` per model. Temperature 0.4 and a max output of 8,000 tokens for every model.
- Providers are small adapters behind one interface: `generate({ system, prompt }) -> { text, usage } | error`. OpenRouter uses its chat completions endpoint; Gemini uses `generateContent`. Keys come from `OPENROUTER_API_KEY` and `GEMINI_API_KEY`; a missing key skips that provider's models with "didn't run".
- The loop is model, then screen, then condition (`alone`, `dualkit`), then runs 1 to 3. Calls are spaced to stay under 20 a minute.
- Extraction takes the first fenced `html` block, or the whole reply when it starts with `<!doctype` or `<html`. No HTML found means the build failed.
- Scoring renders the HTML with the same audit code as `dualkit check` (exported from `packages/cli`) at 390 by 844. Network stays on, so CDN fonts and stylesheets load as they would on a phone.
- **Resumable:** each finished build writes its files at once. A rerun skips builds already on disk for that month. Each call is retried at most twice, with backoff on 429, because failed requests count against the daily cap.

## 2. Scoring and honesty rules

- Per build: `rulesPassed` = rules with no findings, out of the 20 in `@dualkit/rules`, and `score` = the check score.
- **Required parts:** each prompt lists DOM checks for what it must contain, for example `input[type=tel]` or an element whose text matches an IBAN. A build missing any of them is **incomplete**: it counts as 0 rules passed and score 0, and the drill-down names what was missing. A rule that cannot apply otherwise counts as passed, so this stops a model gaining by leaving out the hard parts.
- **Cells:** a cell (model, screen, condition) is the median of its successful runs. Fewer than 2 successful runs out of 3 means the cell shows "didn't run this month".
- **Rows:** a model's alone and with-Dualkit totals are the sums over its five screens (out of 100), shown only when all five cells ran. Lift = with Dualkit minus alone. Score is the mean of the five cell medians.
- The page states it is a small sample of free models, scored by Dualkit's own rules, and links to the raw files for the month.

## 3. Data

- `bench/runs/YYYY-MM/<model>/<screen>/<condition>-<n>.html`: the extracted page.
- `bench/runs/YYYY-MM/<model>/<screen>/<condition>-<n>.json`: raw reply, usage, timings, findings, rulesPassed, score, incomplete parts, or the error.
- The median build of each cell gets a WebP screenshot (q90, 1x) in `apps/site/public/bench/YYYY-MM/`.
- `apps/site/content/bench/YYYY-MM.json`: the month summary the page reads at build time, validated by a schema on both write and read. Because it sits under `apps/site`, the commit triggers a Vercel deploy.

## 4. Automation

`.github/workflows/bench.yml`:
- Triggers: `schedule: '17 4 1 * *'` and `workflow_dispatch` with optional `model` and `month` inputs, to rerun one model or redo a month.
- Steps: checkout, Node, `npm ci`, Playwright 1.55.0 Chromium, run the bench, build the summary, commit `bench/` and the site files as the bench bot, push to main.
- About 180 calls a month (6 models x 30). The job timeout is 3 hours.
- A run that writes nothing new commits nothing.

## 5. The /bench page

- A leaderboard: model, rules passed alone, with Dualkit, lift and score. Then a month picker and a short "how it works" section.
- Each row opens its five screens: a screenshot with the evidence-card crops from the check report design (rings, pins outside the ring, the fix).
- Figma frames go to Sam for sign-off first. The page follows the dualkit.dev v2 rules in the design rulings memory.
- On release: the /updates entry, the roadmap ticks (Prompts, Monthly runner, Leaderboard page, First run), the home page link, the README, the org profile, and launch posts offered to Sam.

## 6. Testing

- Unit: extraction, medians and the 2-of-3 rule, incomplete detection per prompt, row totals and lift, resume skipping, the summary schema, provider adapters against recorded responses.
- End to end: a dry run with a fake provider returning fixture pages (one good, one buggy, one incomplete, one garbage), through to the summary JSON and the page build.
- "If wrong" probes before calling it done, at least: can omission or a one-line page beat an honest build; does the 390px render match what a phone shows; does extraction mis-handle replies with several code blocks; does a 429 storm burn the daily cap; is the median stable when runs differ a lot.

## Out of scope

Paid models, prompts in Arabic, desktop-width scoring, and hand-graded quality. These can come later if the Bench earns attention.
