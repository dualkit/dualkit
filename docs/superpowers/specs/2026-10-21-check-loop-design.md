# Check loop: design

Status: approved by Sam on 21 Oct 2026 ("go"), with both of Claude's calls as written: five new screens, and the page column held for Figma sign-off. Test 2 of the usefulness study (agreed 20 Oct): "The monthly test only compares AI alone with AI plus skills. It never measures how people would actually use the kit: the AI builds, runs `dualkit lint` and `dualkit check`, then fixes what they flag. I add that as a third setup, with more prompts and repeat runs." Calls marked "Claude's call" are mine and open to change.

## Why

Teams will use Dualkit inside a coding agent: build, run the tools, fix. The precision pass made the advice trustworthy enough to follow. This test shows whether following it helps, and whether it breaks pages that worked.

## Pass bar, set before we look

- **Gain:** with the loop, failed rules drop to half or less of AI alone, summed over all screens, in at least 4 of the 6 models.
- **No harm:** in at most 1 fix in 10, a rule that passed before the fix fails after it, or a required part goes missing.
- **Honest scoring:** no more incomplete builds with the loop than with skills alone.

If it falls short, the study report says so and project 4 (skills rewrite) aims at what failed.

## The third setup: `loop`

1. Start from the `dualkit` build of the same model, screen and run. Claude's call: reusing it costs no extra call, and makes "what the loop adds over skills alone" a clean pair.
2. Run `dualkit check` (the scoring render, 390 by 844) and `dualkit lint` on the page.
3. If anything at warning or error level is left, send the model a follow-up in the same conversation: the full findings (rule, message, element, how to fix), and "Fix these. Change only what they need. Reply with the whole file."
4. Score the new page. Repeat at most twice in total. Claude's call: two rounds is what an agent usually gets before a person looks; a third mostly costs calls.
5. The loop build's score is the last page that rendered. A round whose reply has no HTML or fails to render keeps the previous page and is logged as a failed round.

Notes are not sent: they do not change the score, and the layout notes are the noisiest rules.

## More prompts and runs

- Five new screens, ten in all: cart and checkout, support chat, booking with dates, settings with toggles, and a transactions table. Same style as today's prompts, each with required parts. Claude's call on the five: they hit rules today's screens barely touch (mirrored icons, dates, toggles, tables, mixed English and Arabic in chat).
- Runs stay at 3 per cell. Ten screens double the sample, which is the repeat the plan asked for.
- Calls per month: about 6 models x 10 screens x (3 alone + 3 with skills + up to 6 fix rounds) = up to 720, under the 1,000 a day the OpenRouter credit allows. The job timeout goes from 3 to 6 hours.

## Measuring harm

For every fix round, recorded in the build file:

- rules that passed before and fail after,
- required parts that went missing,
- how much of the Arabic text is kept (characters in common, before vs after),
- the before and after screenshots.

I also look at 30 before and after pairs by eye, picked at random, and mark each "better", "same" or "broken". That count goes in the report next to the numbers.

## Where it shows

- The study run happens now, through the bench workflow's manual run, so the result is in before the 1 Nov run and before launch posts. Its files go to `bench/runs/2026-10/`, and the summary is kept off the site until Sam has seen it.
- The study report (`docs/research/2026-10-20-usefulness-sweep.md`) gets a test 2 section with the numbers.
- The /bench page gains a third column, "with the loop", only after Figma frames are signed off. Until then the page shows the two setups it has.

## Non-goals

- No change to how alone and with-skills builds are made or scored, so past months stay comparable.
- No paid models.
- No tool use or agent framework: the loop is plain follow-up messages, so every model can take part.

## Left to the builder

How the follow-up is passed to each provider, how lint runs on a single file, the build-file shape for rounds, and the exact Arabic text measure.
