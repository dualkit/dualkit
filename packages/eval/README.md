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
