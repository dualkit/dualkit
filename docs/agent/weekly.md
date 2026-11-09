# Weekly report

## Week ending 9 November 2026

Covers 2 to 9 November. No agent PR was merged this week, so main has not moved on the score. The last commit on main that changes the proof is #41, and the committed scoreboard is still the one from 1 November. #45 to #50 were opened by a person (Gulf layer, MCP server, Figma plugin, announcement) and do not touch the proof. Agent PRs this week: #42 (last week's retro, still open), #43, #44 and #51 (all open).

### Score movement

| | Main, 1 November | #43 (not merged) | #44 (not merged) |
| --- | --- | --- | --- |
| Apps converted | 8 of 10 | 8 of 10 | 8 of 10 |
| Apps refused | 2 | 2 | 2 |
| Strings moved | 5600 | 5687 | 5665 |
| English left behind | 1043 | 970 | 975 |
| String coverage | 84% | 85% | 85% |
| New type errors | 76 (taxonomy) | 76 | 76 |
| Builds after converting | 6 of 6 | 6 of 6 | 6 of 6 |
| Passes `--finish` | 3 of 8 | not measured | not measured |

On main the score did not move this week: 84%, 8 of 10 converted, 3 of 8 passing `--finish`. Both open PRs claim about one point of coverage, and each was measured alone against the 1 November baseline. They both rewrite the same part of `packages/convert/src/transforms/data.ts`, so their gains may not add up, and nobody has run them together. Neither PR measured `--finish`, so the bar that matters most is unverified for both. The playbook's trigger of "score has not risen in 3 runs" is met on main.

### Biggest problem

Nothing the agents build reaches main. #42 is 7 days old, #43 is 6 days old and #44 is 4 days old, all with no review comment or change, and #44 has green checks. Two of the three have been open past the playbook's 3 day limit. Meanwhile a person merged six non-agent PRs on 6 November. The agent loop is producing work faster than anyone reads it, and it cannot measure the one score that counts, because `--finish` needs Chromium for Playwright 1.55 and the agent environment cannot download it. So both Convert PRs lack a scoreboard commit, which step 6 of the playbook requires. They were right not to commit a scoreboard with a false drop, but it leaves every PR unverifiable on the bar that matters.

### Other findings

1. #43 settled the open question from #42. The two refusals (tailadmin-next with next-intl, tailadmin-react with react-i18next) are correct, because those apps already ship those libraries at the pinned commits. My guess last week that the proof's retry caused them was wrong. #42's "Biggest problem" text and its floor note should be read with that in mind. Supporting an app with its own i18n is a design decision for a person.
2. #43 and #44 are likely to conflict. Both edit `liftData` in `data.ts` and the `components` loop near the end of it, and both add tests to `data.test.ts`. Whichever merges second needs a rebase and a re-measure.
3. #43 and #44 did the open-source search and the review step, and listed their pre-existing test failures (six in `@dualkit/convert` rollback tests). That is better than last week. #44 says root `npm test` passes, while #42 reported that root `npm test` fails in `eval` and `bench` browser tests. One of those is wrong or the environment differed. A person should say which.
4. #43 has a known review note it left unfixed: text that code compares (`tab.label === 'Open'`) would now be translated, because the new pass has no `literalTypes` guard. That is a correctness risk to a converted app, not a style point. Do not merge #43 until it is decided.
5. #51 (postcss 8.5.32) is a clean scout PR with a correct scope. It touches only two `package.json` files and the lockfile. Its claim that postcss 8.5.32 was released on 26 October 2026 is not something I could verify from here.
6. No Rules breach in the week's agent PRs. None touches `apps/site`, `packages/starter`, `packages/proof/apps.json`, a bar, or deletes a test. I did not check #43 or #44 for renamed tests beyond the diffs, which only add tests.

### Changes in this PR

This PR is stacked on #42, because that PR creates `docs/agent/weekly.md` and the playbook edits this one extends. If #42 is merged first, this PR shrinks to the diff below. Playbook changes:

- Builder step 1 now also stops the run when two or more agent PRs touching the same file are open, and when no agent PR has been merged in 7 days, and says to report that instead of opening another PR.
- Builder step 6 now says what to do when `--finish` cannot run: say so in the PR, do not commit a partial scoreboard, and leave the commit to a person with Chromium. This matches what #43 and #44 did.
- Review notes that the PR author found and did not fix must be written under a "Known risk" heading in the PR, so a reviewer cannot miss them.

### For a person to decide

- Review and merge or close #42, #43, #44 and #51. Until that happens the builder should not open more Convert PRs.
- Run `npm run proof -w @dualkit/proof -- --finish` on a machine with Chromium, ideally with #43 and #44 merged together, and commit the scoreboard.
- Whether to give the agent environment Chromium 1.55 (or move the proof to a Playwright version it can install), since this blocks every score check.
- Whether root `npm test` passes on main. #42 says it fails in `eval` and `bench`, and #44 says it passes.
- Whether to build a CI job that fails an `agent/` PR touching forbidden paths (carried from last week).

## Week ending 2 November 2026

Covers 26 October to 2 November. All nine merged PRs landed on 1 November. Only #36 came from an `agent/` branch. #38, #39, #40 and #41 were pushed by a person with Claude as co-author. No builder run has happened since, so the daily builder is not yet running on its own.

### Score movement

| | Start of week (#36, before) | End of week (main at #41) |
| --- | --- | --- |
| Apps converted | 6 of 10 | 8 of 10 |
| Strings moved | 3385 | 5600 |
| English left behind | 1704 | 1043 |
| String coverage | 67% | 84% |
| New type errors | not measured | 76 (all in taxonomy, which does not build before converting) |
| Builds after converting | not measured | 6 of 6 that built before |
| Passes `--finish` | not measured | 3 of 8 |

Coverage rose 17 points. Two cautions on that number:

- It is measured over a different set of apps. Coverage counts converted apps only, and the converted set went 6, then 10, then 8. At 10 of 10 (after #38) coverage was 76%. At 8 of 10 it was 74% before #41 and 84% after. The like-for-like gain from #41 is about 10 points on 8 apps.
- It is a floor on what is left behind, because the scanner cannot see strings built at run time. Coverage is also far from the bar of under 1% of strings missed.

The bar that matters most, `--finish` passing on 25 apps, stands at 3 of 8 converted apps and 3 of 10 proof apps.

### Biggest problem

Two apps went from converted to refused inside #40, and the PR does not mention it. After #39, tailadmin-next and tailadmin-react converted (483 and 460 strings, 84% and 90% coverage). After #40 both are refused with "This app already uses next-intl" and "This app already uses react-i18next". Neither app depends on those libraries upstream. #40 added the `existingI18n` guard in `packages/convert/src/convert.ts`. My unverified guess is that the first `--start` run in the proof adds the library to `package.json` and fails at the screenshot step, then the retry with `--no-baseline` sees the library the first run added and refuses. The `rerun` check only skips the guard when the converted branch and state already exist. Someone should reproduce this on tailadmin-next before trusting the 8 of 10. Refused apps come before missed strings in the playbook, so this is the next builder task.

### Other findings

1. The playbook rules were broken by the PRs that carried the most score. #38, #40 and #41 each edit `apps/site/lib/updates.ts`, and #38, #40 and #41 bump package versions. The rule says not to change `apps/site`. These PRs were not on `agent/` branches, so no check caught them. A person may have meant them as releases, but the rule file does not allow for that.
2. The open-source search was skipped in #36 ("I did not search externally before writing") and is not mentioned in #38, #40 or #41. #35 made the search and review steps required after the first run skipped both, but nothing checks that a PR body names them.
3. Test churn. #36, #38 and #41 replaced six tests whose behaviour changed, for example "refuses an app that already has its own middleware" became "composes with an app that already has its own middleware". These look like honest rewrites. The rule says a person must approve a deleted test, and a rewritten one is not clearly covered. The playbook now asks the PR to list every test it removed or renamed.
4. Root `npm test` fails in `eval` and `bench` browser tests on main, as #36 reported. A failing baseline makes "tests pass" impossible to check. It needs a person to either fix or mark those suites as needing a browser.
5. Scoreboard rows can drop between PRs without any test noticing. This PR adds a floor test for it.

### Changes in this PR

- `docs/proof/floor.json` and `packages/proof/test/floor.test.ts`: the committed scoreboard may not fall below the floor, and every app that built before converting must still build.
- `docs/agent/playbook.md`: PR body requirements, a like-for-like score rule, a list of removed or renamed tests, a forbidden-paths check before pushing, and a note on releases.

### For a person to decide

- Whether the floor of 8 converted apps should stay while the two refusals are unexplained. I set it to what main shows today so the test passes.
- Whether version bumps and `apps/site/lib/updates.ts` entries in a Convert PR are wanted. If so, the playbook should say that a person writes them.
- Whether to make a CI job that fails an `agent/` PR touching `apps/site`, `packages/starter`, `packages/proof/apps.json` or a bar. I did not build it, because adding CI is outside what the playbook lets the agent change.
