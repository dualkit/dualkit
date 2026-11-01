# Dualkit proof suite and daily agent

Date: 1 November 2026. Status: approved.

## Goal

Make the parts Dualkit already has drastically better, and prove it in public. An English product should become fully Gulf-ready and stay that way. No new products until the bars below are met. The Figma plugin and the design system generator stay parked.

Borrow open-source code before writing it. Check the licence and maintenance of anything adopted, and credit it.

## Bars

| Part | Bar |
| --- | --- |
| Convert | `--finish` passes on 25 real apps across Next, Vite and React Router, under 1% of strings missed, 9 of 10 blind wins against plain AI |
| Check and lint | 95% precision and 95% recall on a public test set anyone can rerun |
| Starter | About 40 components in RTL, 9 of 10 blind wins |
| Format | Every field for all six GCC countries, tested against ICU and libphonenumber-js on generated inputs |
| Skills | 50 tasks across 3 models, with enough runs to rule out luck |
| Reviewer | Finds 70% of planted bugs by 30 November 2026, or it is cut |
| Real use | 5 outside teams run Convert on their own product |

## Baseline

`packages/proof` runs Convert on real open-source apps pinned to one commit and writes `docs/proof/scoreboard.md`. A separate scanner counts the English left behind, so Convert does not mark its own work. The first run measures phase 1 only.

## Order of work

1. Baseline and scoreboard.
2. Convert 0.2: apps with existing middleware, settled screenshots, hand-added strings, missed string patterns, locale navigation.
3. Check and lint precision.
4. Format data and the larger skills eval.
5. Starter, in Figma batches signed off by a person.
6. Grow to 25 apps, then recruit 5 outside teams.

## Candidates to borrow

| Need | Source |
| --- | --- |
| String extraction | i18next-cli, translate-kit |
| Safe plans and rollback | safe-i18n |
| Locale navigation | ts-morph with next-intl |
| Stable screenshots | testivai-oss |
| Check precision | axe-core's three-state outcome, BidiLens, miraat |
| Lint accuracy | eslint-plugin-better-tailwindcss, oxlint-tailwindcss |
| Starter | shadcn migrate rtl, NDS-vanilla structure, aegov-dls patterns |
| Format data | taqwim, ibantools, google-i18n-address |
| Skills evals | benchflow |

These are leads and none has been tested here. Do not reuse government identities or marks. Avoid AGPL, GPL and unlicensed code. Keep LGPL tools at arm's length as separate processes.

## Daily agent

Three routines work from `docs/agent/playbook.md`:

- Daily builder: takes the worst-scoring failure, fixes it test-first, and opens a PR that the score must improve.
- Weekly scout: checks new repos, dependency releases and Gulf format changes, and opens adoption PRs.
- Weekly retro: tightens the agent's tests and instructions, and writes a short score report.

Guardrails are in the playbook. Routines start in PR-only mode. Auto-merge comes later, only for `packages/` and tests, never for `apps/site`, `packages/format`, `packages/starter`, or npm releases, because those reach users.
