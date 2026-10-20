# Rules 0.2.0-beta.0 dogfood

Run on 20 Oct 2026 against the production build of apps/site served on port 4310, with `node packages/cli/dist/cli.js check <url> --json` at a 1280px viewport. The rules package was rebuilt first, so all 29 rules ran.

| Route | Score before | Score after fixes | Findings after |
|---|---|---|---|
| / | 28 | 50 | 12 |
| /docs | 96 | 100 | 0 |
| /updates | 78 | 100 | 0 |
| /bench | 96 | 100 | 0 |
| /status | 96 | 100 | 0 |

## Real bugs (fixed)

- /updates, `type/arabic-tracking`, `type/arabic-font`, `type/arabic-leading` on the new rules-0-2-0 entry. The entry quoted an Arabic phrase inside an English paragraph, so the page rules read the whole paragraph as Arabic. Fixed by describing the case in English. Not a separate commit, because the entry was not yet committed.
- / `type/arabic-size`, three Arabic labels (المبلغ, الجوال, التاريخ) at 13px in the Skills preview panel, the panel that claims the agent fixed the screen. Fixed in commit 97bfe90 `fix(site): set the Arabic labels in the Skills preview at 14px`.

## Deliberate demo content (true positives, left as they are)

- / `type/arabic-tracking` x6 and `type/arabic-size` x4 on `.bk` elements in the hero story. The "without Dualkit" column shows Arabic as an agent with no rules builds it: Arial, 0.22em tracking, 13px, letters split by ZWNJ. The rule is right, and the page means it.

## Rulings and rerun

Rerun after the rule changes below: / 50, /docs 100, /updates 100, /bench 100, /status 100. The remaining / findings are the deliberate `.bk` demo (arabic-tracking, arabic-size) and the two mixed-digits findings.

1. `type/arabic-broken-join` on "هـالتاريخ" (Skills preview). A flex item split does break a join, so flex items stay as breaks. The real cause is U+0640 (tatweel): "هـ" is the standard Hijri abbreviation and tatweel is an explicit connector. Ruling: a boundary whose first side ends in tatweel, or whose second side starts with one, is never a candidate. Fixed in `packages/rules/src/dom/joins.ts`, with unit tests for "هـ" and "التاريخ" in separate flex items (quiet) and a flex-item split of مح|مد (still fires).
2. `layout/clipped-text` on the Latin footer wordmark and the odometer digits. The rule is about Arabic, so it now fires only when the clipped box's text contains Arabic (`ClipNode.hasArabic`). A clipped Latin-only box stays quiet, with a test. The title and description say Arabic text. No Arabic mask remains on the site, so there is nothing to list as a deliberate mask. The rolling label holds only ltr and rtl in Latin. The limit is recorded under Known limits: "Masks that reveal part of a strip by transform (odometers, rolling labels) look like clipped text."
3. `content/mixed-digits`, "1,234.50 د.إ" and "1 رمضان 1447 هـ": true positive by the rule's definition; the page is a demo of both systems; no change.

No ignore was added to the site config.
