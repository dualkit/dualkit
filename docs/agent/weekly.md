# Weekly report

## Week ending 23 November 2026

Covers 16 to 23 November. Main did not move. Its last commit is still #50 from 6 November, and the committed scoreboard is still the one from 1 November. No agent PR has been merged for 22 days. Earlier weeks are in #42, #52 and #54, which are all still open and unreviewed. Their findings are not repeated here.

Agent PRs in the week: #54 (last week's retro, opened 16 November, still open) and #55 (the scout log, opened 22 November, still open). No daily builder PR was opened. That is correct under step 1 of the playbook, because #43 and #44 have been open and unchanged for far longer than 3 days.

### Score movement

| | Main, 1 November | Main, 23 November |
| --- | --- | --- |
| Apps converted | 8 of 10 | 8 of 10 |
| Apps refused | 2 | 2 |
| Strings moved | 5600 | 5600 |
| English left behind | 1043 | 1043 |
| String coverage | 84% | 84% |
| New type errors | 76 (taxonomy) | 76 |
| Builds after converting | 6 of 6 | 6 of 6 |
| Passes `--finish` | 3 of 8 | 3 of 8 |

The score did not move, and it has not moved for three weeks. I did not re-run the proof suite this week, because nothing on main changed and the numbers above come from the committed scoreboard.

### Biggest problem

The agent PR backlog has still had no review. Open agent PRs on 23 November: #42 (retro, 22 days), #43 (Convert, 20 days), #44 (Convert, 18 days), #51 (postcss, 15 days), #52 (retro, 14 days), #53 (scout, 8 days), #54 (retro, 7 days), #55 (scout, 1 day) and this PR. None has a human review. The only comment on #54 is an agent note that the CI `check` job fails because Playwright 1.55.0 does not support the runner's Ubuntu 26.04. Every PR will fail that check until a person fixes CI, so even a reviewer who opens one sees a red mark that is not the PR's fault.

The routines that keep running (retro and scout) only add to the pile, and the builder has correctly stopped. The score cannot rise until a person merges or closes something.

### Other findings

1. Rules check: #54 and #55 touch only `docs/agent`. Neither touches `apps/site`, `packages/starter`, `packages/proof/apps.json`, a bar, or deletes a test. No breach.
2. #55 is weak evidence. It says `npm outdated` found nothing and that no open-source candidate was checked in depth. The `npm ci` step that #54 proposes for the playbook is not merged, so the scout could not have known it needed it. This is one more reason to merge #54.
3. The CLDR 48 claim in #55 comes from a web search and is unverified. A person should read the CLDR Arabic delta chart before any currency symbol data changes.
4. This PR changes no playbook text. #54 already proposes the playbook edits, and a second edit to the same lines would conflict with it.

### For a person to decide

- Fix the CI runner or Playwright version, so that PRs can show a green check. Pin `runs-on` to an older Ubuntu image or move to a newer Playwright.
- Review and merge or close #42, #43, #44, #51, #52, #53, #54 and #55. Merging #54 brings in the playbook fixes for the retro and the scout.
- Decide whether to pause the retro and scout routines until the backlog is cleared. Each week they add a PR that nobody reads.
- Run `npm run proof -w @dualkit/proof -- --finish` on a machine with Chromium and commit the scoreboard, ideally with #43 and #44 merged together.
