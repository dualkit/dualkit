# Weekly report

## Week ending 16 November 2026

Covers 9 to 16 November. Main did not move. Its last commit is still #50 from 6 November, and the committed scoreboard is still the one from 1 November. No agent PR has been merged since 1 November, which is 15 days.

Agent PRs in the week: #52 (last week's retro, opened 9 November, still open) and #53 (the scout log, opened 15 November, still open). #51 (postcss, opened 8 November) is just outside the window and is also still open. No daily builder PR was opened this week. That is correct under step 1 of the playbook, which tells the builder to stop when an agent PR has sat unchanged for 3 days.

### Score movement

| | Main, 1 November | Main, 16 November |
| --- | --- | --- |
| Apps converted | 8 of 10 | 8 of 10 |
| Apps refused | 2 | 2 |
| Strings moved | 5600 | 5600 |
| English left behind | 1043 | 1043 |
| String coverage | 84% | 84% |
| New type errors | 76 (taxonomy) | 76 |
| Builds after converting | 6 of 6 | 6 of 6 |
| Passes `--finish` | 3 of 8 | 3 of 8 |

The score did not move. It has not risen in the last 3 builder runs, and no builder run happened this week. The two open Convert PRs from earlier (#43 and #44) each claim about one point of coverage, measured alone and never together. Neither measured `--finish`.

### Biggest problem

Nobody has reviewed any agent PR in 15 days, and the agent keeps adding to the pile. Open agent PRs and their age on 16 November: #42 (retro, 15 days), #43 (Convert, 13 days), #44 (Convert, 11 days), #51 (postcss, 8 days), #52 (retro, 7 days), #53 (scout, 1 day), and this PR. None has a review comment. Two of them are retros that sit on top of each other, and #52 only makes sense once #42 is merged. A person merged six PRs on 6 November, so the repository is being looked at, but the agent PRs are not being read. The retro is itself part of the problem this week: adding a third report on the same finding costs the owner attention and changes nothing.

### Other findings

1. The playbook stop rules worked. The builder did not open a new Convert PR on top of #43 and #44. The retro and scout routines have no such rule, so they kept opening PRs. This PR adds one for the retro.
2. #53 is a sound scout note with honest caveats. It says the `npm outdated` result is weak because no install was present, and that the libphonenumber-js check was not verified upstream. Both caveats mean the scout checked less than it appears to. This PR adds a scout step to run `npm ci` first and to mark any unverified claim.
3. The Unicode claims in #53 (Saudi riyal sign U+20C1, dirham U+20C3 and rial U+20C4 in Unicode 18) come from a web page and I could not verify them. Treat them as unchecked data until a person confirms them against unicode.org.
4. No Rules breach in the week's agent PRs. #51, #52 and #53 touch only `docs/agent`, `package.json` files and the lockfile. None touches `apps/site`, `packages/starter`, `packages/proof/apps.json`, a bar, or deletes a test.
5. Findings from the 9 November retro still stand and are not repeated here: do not merge #43 until its unguarded string comparison risk is decided, #43 and #44 will conflict, and `--finish` cannot run in the agent environment because Chromium for Playwright 1.55 cannot be downloaded.

### Changes in this PR

This PR branches from main, so it does not depend on #42 or #52. If either merges first, `docs/agent/weekly.md` will conflict and the week sections should be kept in date order.

- Weekly retro now starts by listing unmerged retro PRs, links to them instead of repeating their findings, and says so in the PR when the owner has not reviewed any agent PR.
- Weekly scout now runs `npm ci` before `npm outdated` and labels any claim it could not check against the upstream source.

### For a person to decide

- Review and merge or close #42, #43, #44, #51, #52 and #53. Until at least one agent PR is merged, the daily builder will keep stopping and the score cannot move.
- Whether to pause the retro and scout routines until the backlog is cleared, since both only add to it.
- Run `npm run proof -w @dualkit/proof -- --finish` on a machine with Chromium and commit the scoreboard, ideally with #43 and #44 merged together.
- Whether to give the agent environment a Chromium that matches Playwright 1.55.
