# Skill fixes probe (19 Oct 2026)

A report-only check after project 1 (PR #10). Run 39299541327 on a throwaway branch: month 2099-05, models dots-3-note, laguna-s, nemotron-3-super and minimax-m3.1-flash, screens payment-summary and order-history, three runs each, alone vs Dualkit. 48 builds. Four hit the token cap (three Dualkit, one alone) and are left out of the rates.

| Rule | Alone | Dualkit | Rehearsal 2 (before the fixes) |
|---|---|---|---|
| type/arabic-size | 12 of 23 (52%) | 4 of 21 (19%) | 33% alone, 73% Dualkit |
| bidi/punctuation-flip | 0 of 23 | 1 of 21 (5%) | 0% alone, 10% Dualkit |
| Rules passed per screen (of 20) | 17.87 | 18.76 | |

The size result is now the other way round: Dualkit builds fail the size rule far less often than models working alone.

Punctuation is one build: minimax-m3.1-flash, payment-summary, Dualkit run 2. Read by hand, the flag is real. The line `3 November 2026 (<bdi>22 صفر 1448 هـ</bdi>)` puts the brackets outside the isolate, so the opening bracket next to the Gregorian date draws the wrong way. rtl-layout already says to put brackets inside the isolate. The model did not follow it here. One build in 21 is within noise for this sample, so it is not counted as a skill regression, but the pattern goes to project 4: the gulf-formats Hijri example should show a Gregorian and Hijri pair on one line, with the brackets inside the `<bdi>` (or the two dates on two lines, as the starter's DateDisplay does).

Token-cap failures: dots-3-note hit the cap on two of three Dualkit order-history builds. Worth watching in the bench refresh (project 6): the skills add context, and a model that runs long may need a higher cap.
