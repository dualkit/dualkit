# V2 step 3: judge calibration and the visible baseline

Run on 23 Oct 2026 with `@dualkit/eval`, on the committed Bench pages for 2026-10. The pages are the project's own, so models and screens are named. No site or company is named.

## The judge failed calibration

The judge agrees with Sam on 11 of 20 blind pairs. The bar is 16. Every judge number below is **not calibrated, not for the site**.

| judge model | agrees with Sam | result |
| --- | --- | --- |
| gemini-flash-lite-latest (default) | 11 of 20 | does not pass |
| gemini-flash-latest | no score | not completed |

gemini-flash-latest could not be scored. Its free tier allows 20 requests per day per project, and the first attempt used that up with 6 pair verdicts read from the cache and the rest failing with HTTP 429 (quota exceeded, retry in about 17 hours). A free-tier score for it is not possible today. No paid call was made, as agreed, so the search for a passing model stops here. The 4 of 20 figure mentioned in a handoff note is not a result I could reproduce: the run never finished and wrote no result file.

Sam's note on the 20 pairs: "Some are janky and the spacing is off." That is about the pages, not a request to change the checklists, so the checklists and the prompt version are unchanged. It does suggest that Sam weighs polish and spacing, and the checklists do not ask about either. They are about Arabic correctness, such as numbers, arrows and alignment. A judge that follows the checklists can disagree with a person who is reacting to how finished a page looks.

### Where the judge and Sam split

Nine of 20 pairs disagreed. In six of them the judge did not give the same answer with the sides swapped, so it counted as no answer. In the other three it picked a side.

| slot | model | screen | Sam | judge |
| --- | --- | --- | --- | --- |
| 1 | dots-3-note | address-form | Dualkit | not held when swapped |
| 4 | minimax-m3.1-flash | booking | Dualkit | alone |
| 5 | dots-3-note | checkout | Dualkit | not held when swapped |
| 7 | laguna-s | order-history | Dualkit | not held when swapped |
| 9 | dots-3-note | otp | Dualkit | alone |
| 12 | dots-3-note | payment-summary | Dualkit | not held when swapped |
| 13 | laguna-s | profile | alone | not held when swapped |
| 15 | laguna-s | settings | alone | Dualkit |
| 18 | gemini-flash-lite | support-chat | alone | Dualkit |

Across all 20 pairs the judge failed to hold its answer 8 times, the largest single cause of the miss. Sam chose the Dualkit page in 6 of the 9 disagreements, so the judge is more cautious, or less moved by finish, than Sam.

## Baseline against the Dualkit page (not calibrated, not for the site)

Judge: gemini-flash-lite-latest. Every pair is judged twice with the sides swapped, and only an answer that holds both ways counts.

**Dualkit wins 40 of 110 pairs. Alone wins 36, 1 tie, and 33 did not hold when swapped.** 1 pair failed and 1 was excluded because both pages were blank. 1 result was a win by default for the page that was not blank. Spend: $0.00.

### By model

| model | Dualkit | alone | tie | not held | failed | excluded |
| --- | --- | --- | --- | --- | --- | --- |
| dots-3-note | 10 | 6 | 0 | 9 | 0 | 0 |
| gemini-flash-lite | 10 | 14 | 0 | 5 | 1 | 0 |
| laguna-s | 10 | 7 | 0 | 9 | 0 | 1 |
| minimax-m3.1-flash | 10 | 9 | 1 | 10 | 0 | 0 |

### By screen

| screen | Dualkit | alone | tie | not held | failed | excluded |
| --- | --- | --- | --- | --- | --- | --- |
| address-form | 1 | 8 | 0 | 3 | 0 | 0 |
| booking | 5 | 5 | 0 | 1 | 0 | 0 |
| checkout | 2 | 6 | 0 | 4 | 0 | 0 |
| order-history | 7 | 2 | 0 | 2 | 0 | 0 |
| otp | 2 | 2 | 0 | 7 | 0 | 1 |
| payment-summary | 2 | 2 | 0 | 3 | 0 | 0 |
| profile | 4 | 5 | 0 | 3 | 0 | 0 |
| settings | 9 | 0 | 0 | 2 | 1 | 0 |
| support-chat | 4 | 4 | 1 | 3 | 0 | 0 |
| transactions | 4 | 2 | 0 | 5 | 0 | 0 |

Each model has 10 Dualkit wins, so the table does not separate models. The screens do differ: settings and order-history lean to Dualkit, address-form and checkout lean to alone. With 33 of 110 not holding, none of this is firm.

### Which checklist points the judge marked differently between sides most often

Counted over every judged call. "Marked differently" means one page passed the point and the other failed it.

| screen | point | differed | calls |
| --- | --- | --- | --- |
| settings | phone number keeps its plus sign and order | 20 | 23 |
| settings | numbers read correctly, digits and symbols in order | 19 | 23 |
| booking | time slots from 9:00 to 12:00 all there and in order | 17 | 22 |
| address-form | numbers read correctly | 16 | 24 |
| order-history | numbers read correctly | 16 | 22 |
| otp | numbers read correctly | 16 | 20 |
| otp | countdown shows 0:45 with its digits in order | 16 | 20 |
| checkout | back arrow at the top points right | 15 | 24 |
| order-history | order number keeps its hash and order intact | 15 | 22 |
| transactions | numbers read correctly | 15 | 22 |

Number order and direction dominate, which is what the checklists are built to catch. Nothing here covers spacing or polish, which is what Sam's note was about.

## Baseline against the loop page (partial, not calibrated, not for the site)

This run was cut short. The free Gemini daily quota ran out partway through, retries crawled, and the run was stopped before it wrote its results file, so there are no per-model or per-screen totals from the tool. The counts below come from the run log. A loop page counts as Dualkit.

| outcome | pairs |
| --- | --- |
| Dualkit (loop page) wins | 39 |
| alone wins | 28 |
| did not hold when swapped | 24 |
| failed on quota | 14 |
| not reached | about 7 |

That is 91 pairs judged out of about 112. Of the 14 failures, 11 are on minimax-m3.1-flash, so that model's loop result is mostly missing. Failed pairs are not cached and can be filled in by rerunning once the quota resets. Spend: $0.00.

## What to do next

- Do not publish any of these numbers.
- Rerun calibration with gemini-flash-latest after the daily quota resets, or with a paid model inside the $3 cap if Sam agrees.
- Decide whether the checklists should gain a point for finish and spacing. That would change the prompt version, so it needs Sam's say.
- Rerun the loop baseline after the reset to fill the failed pairs.
