# Judge on paid models: still fails calibration

Measured on 23 and 24 Oct 2026 against the same 20 blind pairs Sam judged for the [baseline](2026-10-23-judge-baseline.md). The pass bar is 16 of 20.

## What changed

Every screen's checklist has an eleventh point: "Is the spacing even and the page tidy, with nothing cramped, overlapping or out of line?" Sam judged the pairs on polish and spacing, and no point asked about it.

## Results

| judge | decided by checklist points | decided by overall pick only | cost |
| --- | --- | --- | --- |
| Gemini Flash Lite, free (baseline, 10 points) | 11 of 20 | not measured | $0.00 |
| Claude Haiku 5.5, OpenRouter | 11 of 20 | 12 of 20 | $0.03 |
| Gemini 3.8 Flash, OpenRouter | 10 of 20 | 11 of 20 | $0.49 |

The overall pick column is scored from the answers the judge already gave, so it cost nothing. No judge passes.

## What it shows

- The two paid models gave the same verdict on only 11 of 20 pairs. They disagree with each other about as often as they disagree with Sam, so a stronger model alone does not fix the judge.
- Pairs 1, 4, 7, 9 and 13 went against Sam with all three models.
- Sam picked the Dualkit page on 10 of 20 pairs, the plain page on 7, and called 3 even. The bar for "visibly better" is 80%, so by a person's eye Dualkit is only a little better today.

## Decision

Sam agreed on 24 Oct to stop work on the judge. No judge number goes on the site. The checklists and the judge stay in `@dualkit/eval` in case a future model can do this. "Visibly better" is now tested by Sam judging blind pairs himself.

The next step is the kit, built on shadcn/ui's right-to-left components, followed by 10 blind pairs judged by Sam.

## Spend

$0.53 of the $3.00 monthly cap, from the $10 OpenRouter credit. OpenRouter keeps the 1,000 free requests a day for accounts that have bought $10 in total, whatever the current balance, so this spend does not lower it.
