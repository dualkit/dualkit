# Payment summary eval

The task is in `task.md`: a bilingual UAE checkout component. Each run was one fresh Claude Sonnet agent. The baseline runs had no skills. The with-skills runs had the four Dualkit skills loaded. Run `bash score.sh runs/<file>` to score a run. Every flagged line was also read by hand.

| Check | Baseline (3 runs) | With skills (3 runs) |
|---|---|---|
| Phone and IBAN examples isolated inside Arabic text | 0/3 | 3/3 |
| `timeZone` passed when formatting dates | 1/3 | 3/3 |
| Digit system pinned, not left to Intl defaults | 1/3 | 3/3 |
| Typed Arabic-Indic and Persian digits normalised | 2/3 | 3/3 |
| Arabic line-height, size and tracking overrides | 0/3 | 3/3 |
| Arabic `zero` plural form | 2/3 | 3/3 |
| Capitals kept out of stored strings | 0/3 | 3/3 |
| No physical left or right classes | 3/3 | 3/3 |

The first with-skills round found a gap in the skills: all three runs wrapped the Arabic amount in `<bdi dir="ltr">`, which puts the currency on the wrong side. The RTL skill now says `dir="ltr"` is only for runs with no Arabic letters in them. The runs here come from the round after that fix.
