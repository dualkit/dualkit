# @dualkit/eval

Private package. It measures how often Dualkit's tools are right.

- Precision: of the findings check and lint report, how many are real. It uses hand labels on real sites and repos.
- Recall: of the known Arabic bugs, how many the tools find. It plants bugs in clean pages and asks both tools to find them.

The labels, repos and recordings are private and live outside this repo. Pass the folder with `--data <dir>` or set `DUALKIT_SWEEP_DATA`. Nothing from it is committed, and the markdown report holds counts per tool, rule and bug kind only.

## Run

Build `@dualkit/rules`, `@dualkit/lint` and the `dualkit` CLI first.

```
npm run eval -w @dualkit/eval -- precision --data <dir>
npm run eval -w @dualkit/eval -- misses
npm run eval -w @dualkit/eval -- all --data <dir>
```

The report prints to stdout. The full result goes to `packages/eval/out/<date>.json`, which is gitignored and may hold names. The miss set takes a few minutes. Precision replays recordings and takes longer.

The miss set is frozen in `cases/miss-set-2026-10.json`: 64 planted cases (bug kind and page under `bench/runs`) plus the one real miss in `cases/real.json`, 65 in all. `misses` reads that file, so recall stays comparable when `bench/runs/2026-10` gains pages. `--rebuild-cases` regenerates the list from the current pages and rewrites the file. Only do that on purpose, since it changes what every later run measures.

## Measuring the reviewer

Add `--review` to `misses`, `precision` or `all` to run the vision reviewer too. The report then gains a review column and a dualkit column. A case counts for dualkit when check, lint or review catches it, and a review finding counts only at confidence 0.7 or more.

- The reviewer needs `GEMINI_API_KEY`. Without it, check and lint still run, the report says review was skipped and why, and the exit code stays 0.
- Results are cached in `packages/eval/out/review-cache/`, keyed on the page, the model and the prompt version, so a rerun costs nothing. Skipped results are never cached.
- Spend is capped at $3 a month in `packages/eval/out/spend-<YYYY-MM>.json`. The last line of the run log reads `Spent $X.XX of $3.00 this month`.
- Review precision uses hand labels in `labels/review-<name>.json`, with the findings listed in `rsamples/<name>.md`, in the same shapes as the check labels. Until labels exist, the report shows review precision as unlabelled, with the number of findings waiting.
