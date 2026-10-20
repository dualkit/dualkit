# Rules 0.2.0-beta.0 dogfood

Run on 20 Oct 2026 against the production build of apps/site served on port 4310, with `node packages/cli/dist/cli.js check <url> --json` at a 1280px viewport. The rules package was rebuilt first, so all 29 rules ran.

| Route | Score before | Score after fixes | Findings after |
|---|---|---|---|
| / | 28 | 28 | 23 (see below) |
| /docs | 96 | 96 | 1 |
| /updates | 78 | 96 | 1 |
| /bench | 96 | 96 | 1 |
| /status | 96 | 96 | 1 |

## Real bugs (fixed)

- /updates, `type/arabic-tracking`, `type/arabic-font`, `type/arabic-leading` on the new rules-0-2-0 entry. The entry quoted an Arabic phrase inside an English paragraph, so the page rules read the whole paragraph as Arabic. Fixed by describing the case in English. Not a separate commit, because the entry was not yet committed.
- / `type/arabic-size`, three Arabic labels (المبلغ, الجوال, التاريخ) at 13px in the Skills preview panel, the panel that claims the agent fixed the screen. Fixed in commit 97bfe90 `fix(site): set the Arabic labels in the Skills preview at 14px`.

## Deliberate demo content (true positives, left as they are)

- / `type/arabic-tracking` x6 and `type/arabic-size` x4 on `.bk` elements in the hero story. The "without Dualkit" column shows Arabic as an agent with no rules builds it: Arial, 0.22em tracking, 13px, letters split by ZWNJ. The rule is right, and the page means it.

## False positives or disputed, awaiting a ruling

1. `type/arabic-broken-join` on `/`, "هـالتاريخ".
   - Element: `span.v3-pv-soft` inside `div.v3-pv-diff-line:nth-of-type(4)` (Skills preview, `SkillsDiff.tsx`).
   - The row is a flex container with two flex items. The first holds the value "1 رمضان 1447 هـ", which ends in heh. The second holds the label "التاريخ" inside a span set to `display: inline-flex`.
   - The two text nodes sit in separate flex items, so they are in different formatting contexts and cannot join. The reader treats them as one word because it only looks at the nearest common ancestor, and then blames the inline-flex span.
   - Why it is false: flex items are blockified, with a 12px gap and `justify-content: space-between` between them. No glyph is ever shaped across that boundary.
   - Likely fix, for the controller to decide: when the two text nodes have a flex or grid container, or any block-level box, between them below the common ancestor, there is no join to break.
2. `layout/clipped-text` on `/`, `/docs`, `/updates`, `/bench`, `/status`, `body > footer.v3-foot > div.v3-foot-end`.
   - The footer wordmark "Dualkit" is `aria-hidden` and Latin, cropped on purpose by `overflow: hidden` with `line-height: 0.8`. 60px is cut at the bottom. The crop is the design.
3. `layout/clipped-text` on `/`, seven odometer digit columns (`span.od`, 244 to 273px) and one rolling label (`span.roll`, 28px).
   - Each is a window onto a strip of digits (or ltr/rtl labels) moved by `translateY`. The box is meant to show one digit and hide the rest.
   - The rule cannot tell a mask from a bug here.
4. `content/mixed-digits` on `/`, two findings, "1,234.50 د.إ" and "1 رمضان 1447 هـ" in the Skills preview.
   - Both are Western-digit values inside `lang="ar"` spans. The rest of the page is English with Western digits, and the Arabic story section uses Arabic-Indic digits, so the rule sees two systems on one "screen" because a long marketing page is one screen to it. Western digits are the Gulf default for amounts, so this is a design choice. Disputed, not clearly a bug.

Items 2 and 3 are the same limit: the rule has no way to read intent for decorative or animated masks. The existing `ignore` config in `dualkit.config.json` could cover them for the site's own CI, but that is a policy call for the controller.
