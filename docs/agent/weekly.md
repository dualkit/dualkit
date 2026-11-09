# Weekly report

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
