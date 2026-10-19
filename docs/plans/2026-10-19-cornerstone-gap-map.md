# Dualkit cornerstone: gap map (19 Oct 2026)

Sam's brief: Dualkit must be "EXTREMELY better, cover more ground, use cases and edge cases, do more; the cornerstone". A practical, useful solution for building design systems in the Middle East: correct RTL formatting and everything else that matters, building design systems with tokens, and auditing GCC design for the region. Serves everyone (design-system teams, engineers with agents, reviewers). Keep the current shape of Dualkit; thicken and strengthen it.

Approved order (Sam, 19 Oct): six projects, one at a time, each through brainstorming -> design doc -> plan -> subagent-driven build with tests and review.

1. Skill fixes (stop Dualkit hurting results)
2. Formats for all six GCC countries
3. Rules 20 -> ~40, plus a source linter
4. Skills rewritten and expanded
5. Design system: tokens, components, conformance maps, Figma audit
6. Bench refresh (harder prompts, new rules); first real run 1 Nov 2026 with whatever is ready

## Evidence: bench rehearsal 2 (run 39255100465, month 2099-03)

Built per model: dots-3-note 28/30, laguna-s 25/30, north-mini-code 17/30 (Cohere ignores reasoning.max_tokens: 14k-21k reasoning tokens vs a 4k cap, 13/15 dualkit builds hit the 16k cap), gemini-flash 8/30 (Google free quota ~20/day), gemma-4-31b 7/30 (upstream 429 despite 4 min of retries), nemotron-3-ultra 0/30 (NVIDIA 500 every call, also 0 in rehearsal 1).
Paired lift: +0.4 rules per screen over 14 cells.

Per rule, fail rate alone vs with Dualkit (ok builds, 55 alone / 30 dualkit):
- type/arabic-font 71% -> 37% (helps, still a gap)
- bidi/unisolated-number 40% -> 7% (works)
- type/arabic-size 33% -> 73% (worse)
- bidi/punctuation-flip 0% -> 10% (new failures)
- 9 rules never fail at all: lang-mismatch, missing-dir, missing-lang, placeholder-text, both icon rules, arabic-ltr-block, text-align-left, arabic-italic

Why arabic-size got worse: partly sampling (30 vs 55 scored builds; dots-3-note is 10/13 dualkit vs 0/15 alone, others move little). Mechanism: rtl-layout skill teaches Tailwind classes, so 7/30 dualkit builds load Tailwind (0/55 alone) and use `text-xs` (12px) / `text-[11px]` for badges, field labels, nav labels, the ر.س abbreviation, VAT notes, "Gregorian/Hijri" sub-labels. The copied `:lang(ar)` snippet in type-pairing sets no size; the 14px floor is only a table row.
Punctuation-flip in dualkit builds: Latin-led labels inside Arabic (`الgregorian:`), bare `(AED)` spans in RTL. rtl-layout never covers Latin-led labels or bracketed codes.

## Current state (inventory)

Skills (plugin/skills, ~70 lines each):
- bilingual-copy: plurals, placeholders, isolation, case, gender-neutral, punctuation, switcher, key parity. Bugs: `formatCount()` undefined; "keep the Latin full stop" unexplained; nothing on secondary-language line styling.
- gulf-formats: digits, decimals, abbreviations, 2025 signs, minor units, Hijri, weekends, UAE/KSA phone, Emirates ID, IBAN. Bugs: promises "wider Gulf" but phones only UAE/KSA, no Oman IBAN; timeZone "always" but optional in formatHijri; no weekend helper; dirham-sign advice vague.
- rtl-layout: dir/lang, logical props table (Tailwind-heavy), transforms, isolation, LTR inputs, mirror table. Bugs: promises punctuation help but has none; says inputs "always LTR" while Field and rule fix use dir="auto"; `inset-s-0 (v4.3+)` unverified.
- type-pairing: font pairs, unicode-range, size-adjust, zero tracking, no italics, leading 1.6-1.8, 14/16px. Bugs: size floor only in a table; snippet has no size; says -apple-system covers Apple only but the rule regex accepts -apple-system/system-ui/segoe ui as Arabic fonts; size-adjust invisible to the size rule.

Rules (packages/rules, 20): blind spots — `#A-10293` (one capital) escapes unisolated-latin; font rule checks names not loading (`'IBM Plex Arabic'` passes); system-ui counts as Arabic; size ignores size-adjust and treats a lone ر.س like a paragraph; leading skipped on single-line labels; punctuation-flip checks only the last run; icons found by name only (inline SVG chevrons invisible); Arabic-Indic-only digit groups skipped; input values/placeholders not read.

Format (packages/format): toArabicDigits/toWesternDigits; formatMoney for AED SAR QAR KWD BHD OMR; formatHijri/toHijri (Umm al-Qura, timeZone optional); UAE + Saudi phones; Emirates ID; IBAN AE SA BH KW QA (no OM). No Qatar/Kuwait/Bahrain/Oman phones, no weekend helper, no Gregorian formatter (lives in starter DateDisplay).

Starter: Button, Field, DigitInput, Amount, DateDisplay, Tabs, Sheet, Toast; DTCG 2025.10 resolver tokens (primitives, semantic, script en/ar; theme light/dark) -> CSS vars, Tailwind theme, Figma variables JSON. Direction handled by dir + logical CSS, not tokens.

CLI `dualkit check`: URL or local HTML file only (no Figma, no stdin). HTML report, JSON, min-score, config; GitHub Action.

Bench prompts: address-form (Dubai, Makani), order-history (Saudi, Hijri), otp (Saudi bank), payment-summary (UAE, AED), profile (UAE, IBAN).

## Research: what is missing (agent research 19 Oct; [verify] = check official source before shipping)

P0
1. New currency signs: Saudi riyal U+20C1 (Unicode 17, Sep 2025); U+FDFC is the old rial ligature, never use it for the riyal. UAE dirham (CBUAE, 27 Mar 2025) and Omani rial (CBO, 19 Nov 2025) reported as U+20C3 / U+20C4 in Unicode 18 [verify]. Fonts lag, so tofu: ship SVG/icon fallback + lint against U+FDFC. CBUAE rules: sign before amount, space, clear space 1/3 sign height, match digit height/weight, never pair with "AED"/"Dh", not for logos/app icons/legal text. Sources: en.wikipedia.org/wiki/Saudi_riyal_sign; unicode.org/L2/L2025/25076-sew-recommendations-saudi-riyal.pdf; centralbank.ae dirham_currency_symbol_guideline_english.pdf; gulfnews "8 mistakes".
2. National IDs: UAE 784-YYYY-NNNNNNN-C Luhn (YYYY not always birth year); KSA 10 digits, 1 citizen / 2 resident (Iqama), Luhn-style [verify]; Kuwait Civil ID 12 digits century+YYMMDD+serial+check [secondary]; Bahrain CPR 9 digits YYMM+4+check [secondary]; Qatar QID 11 digits, Oman civil 8-9 [verify]. Ship validator + mask + masked display.
3. Digits: CLDR defaults for ar-* have flipped between arab/latn across releases; never rely on locale default, always set numberingSystem; lint Intl.*('ar…') without -u-nu-.
4. Hijri: name islamic-umalqura explicitly (never bare islamic); ICU off-by-one reports; test against an Umm al-Qura table.
5. VAT: KSA 15%, VAT no. 15 digits starting and ending with 3 (BR-KSA-40); UAE 5%, TRN 15 digits (prefix unconfirmed); Bahrain 10% since 2022; Oman 5%, OM+10 [single source]; Qatar and Kuwait no VAT.
6. E-invoicing: ZATCA Phase 2 wave 25 (SAR 187,500 threshold, deadline 1 Feb 2027); simplified invoice TLV base64 QR, tags 1-5 (seller, VAT no., timestamp, total, VAT), Phase 2 tags 6-9 [verify]. UAE Peppol 5-corner, pilot 1 Jul 2026, AED 50m+ live 1 Jan 2027, others 1 Jul 2027 [verify].
P1
7. Addresses: KSA National Address (building 4, street, district, city, postcode 5, additional 4; short address 4 letters + 4 digits); UAE no postcodes, Makani 10 digits (5+5); Qatar zone/street/building, PO Box; Kuwait governorate/area/block/street/house [verify]; Bahrain building/road/block [verify].
8. Phones [verify]: Qatar +974 8 digits mobiles 3/5/6/7; Kuwait +965 8 digits 5/6/9; Bahrain +973 8 digits 3/6; Oman +968 8 digits 7/9. Phone/email/URL/IBAN/password inputs dir=ltr, text-align end; normalise Arabic-Indic digits.
9. Privacy: KSA PDPL enforceable Sep 2024 (SDAIA transfer rules); UAE PDPL 45/2021. Consent copy AR/EN, ID masking.
10. Weekends: UAE federal Sat-Sun since 2022 (Sharjah gov Fri-Sun); KSA, Kuwait, Bahrain, Qatar, Oman Fri-Sat. Week start Sunday (KSA etc.) vs Monday (UAE). Ramadan hours; moon-sighted holidays.
11. Type: letter-spacing breaks joins; styling part of a word breaks joins; no text-transform; no synthetic italic; kashida justification unreliable, prefer start.
12. Font stacks: SF Arabic, Segoe UI, Noto Naskh/Sans Arabic; Google: IBM Plex Sans Arabic, Noto Sans Arabic, Readex Pro, Cairo, Tajawal, Almarai. Check numerals and U+20C1-20C4 glyph coverage; tabular-nums.
13. Bidi: media/clock/check/logo/graphs never mirror; back/forward, progress, carousels mirror; time axis stance; translateX/keyframes don't flip; canvas/SVG ignore dir; scrollLeft sign; ellipsis side.
P2
14. Design systems: UAE Design System designsystem.gov.ae v3 (Tailwind 4, open source); KSA DGA Platform Code (Mar 2025, 33+ components). Publish conformance mappings. DTCG direction + script modes; Figma lacks direction-aware auto layout.
15. Language: six plural forms, no concatenation; gendered strings via ICU select; Arabic name structure, transliteration variants, search normalisation (alef/hamza, ta marbuta).
16. Screen readers: no solid data; Dualkit could publish a test matrix.
Competitors: stylelint-use-logical, stylelint-plugin-logical-css, eslint-plugin-rtl-friendly, eslint-plugin-logical-properties, rtlcss; Figma RTL Layout, Flip UI, RTLAuto; EmiratesKit (.NET), django-localflavor; arabicfmt (npm + MCP, closest competitor, check scope). Nobody covers cross-country ID/address/VAT bundles, Hijri correctness, currency-sign fallback, e-invoice QR, or Arabic typography lint.
