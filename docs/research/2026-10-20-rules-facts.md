# Facts for project 3 lint rules (checked 20 Oct 2026)

Confidence key: **VERIFIED** = the primary source was read in this session and says it. **SECONDARY** = reputable but not the vendor or standard itself, or the primary source implies it without stating it. **UNVERIFIED** = no source found, or the source was unreachable. A rule must only fire on VERIFIED facts. SECONDARY and UNVERIFIED facts are listed so nobody builds on them by accident.

Format follows `2026-10-19-gcc-facts.md`. Date checked is 20 Oct 2026 for every row.

Notes on access:
- `developer.apple.com/fonts/system-fonts/` returned a truncated page (the list ends at "Lahore Gurmukhi Bold"), so entries after that point, including any "SF ..." names, were not readable.
- The Apple macOS and iOS lists name fonts but do not state which scripts each font covers. Whether a named font has Arabic glyphs is therefore not VERIFIED from Apple for any macOS or iOS font. Rows say so.
- The CBUAE PDF was downloaded and read as text with `pdftotext` (27 KB of text, 29 pages). Quotes below are from that text.

---

## 1. System fonts with Arabic coverage

### 1a. Windows 10 and 11 (Microsoft Learn)

Microsoft's per-family pages carry OpenType script metadata (`slng` = supported languages/scripts, `dlng` = design languages/scripts) and OS/2 code pages. `Arab` in `slng` or code page 1256 means the font has Arabic glyphs. The "Windows typography" page then names the UI fonts per script.

| CSS `font-family` | Arabic glyphs | Evidence | Confidence |
|---|---|---|---|
| `Segoe UI` | Yes | Family page: "supports a very wide range of languages and scripts, including the Latin, Greek, and Cyrillic alphabets, Arabic, Hebrew..."; `dlng`/`slng` include `'Arab'`; code page 1256. Typography page: "User-interface font for Arabic, Armenian, Georgian, and Hebrew." | VERIFIED |
| `Tahoma` | Yes | `dlng:'Arab', 'Armn', 'Cyrl', 'Grek', 'Hebr', 'Latn', 'Thai'`; `slng` includes `'Arab'`; code page 1256 | VERIFIED |
| `Arial` | Yes | `slng` includes `'Arab'`; code pages 1256, 864, 708. Typography page: "Supports European and Middle Eastern scripts (Latin, Greek, Cyrillic, Arabic, Armenian, and Hebrew). Black weight supports European scripts only." | VERIFIED. Arial Black is a separate family and is not listed for Arabic |
| `Times New Roman` | Yes | `slng` includes `'Arab'`; code pages 1256, 864, 708. Typography page: "Legacy font that supports European scripts (Latin, Greek, Cyrillic, Arabic, Armenian, Hebrew)." | VERIFIED |
| `Courier New` | Yes | Typography page: "Serif fixed width font that supports European and Middle Eastern scripts (Latin, Greek, Cyrillic, Arabic, Armenian, and Hebrew)." | VERIFIED (typography page only; the family page was not opened) |
| `Calibri` | Yes, upright styles only | Typography page: "Arabic available in the uprights only." | VERIFIED |
| `Aldhabi`, `Andalus`, `Arabic Typesetting`, `Microsoft Uighur`, `Sakkal Majalla`, `Simplified Arabic`, `Traditional Arabic`, `Urdu Typesetting` | Yes | Listed under "Arabic Script Supplemental Fonts: Languages using Arabic script; e.g., Arabic, Persian, Urdu" in the Windows 11 font list | VERIFIED as members of the Arabic Feature On Demand package. That package is optional, so installation on a given machine is not guaranteed. UNVERIFIED whether it installs by default for Arabic-region Windows |
| `Segoe UI Variable` | **No** | Typography page: "Variable font that supports Latin, Greek, and Cyrillic." Same page: "Segoe UI Variable is our font for English, European languages, Greek, and Russian. For other languages, see the following recommendations" and then names Segoe UI for Arabic | VERIFIED. Do not treat as an Arabic family |
| `Selawik` | Not stated | Described only as metrically compatible with Segoe UI. It is an app-bundled font, not shipped with Windows | UNVERIFIED for Arabic |

Windows 10 font list was not opened. Everything above is Windows 11. The Segoe UI, Tahoma, Arial and Times New Roman family pages list Windows 10 and Windows 7 as suppliers, so those four are on Windows 10 as well (VERIFIED from the "Products that supply this font" tables). Courier New, Calibri and the supplemental fonts are Windows 11 only as far as this session verified.

Sources:
- https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list (the FOD section "Arabic Script Supplemental Fonts")
- https://learn.microsoft.com/en-us/typography/font-list/segoe-ui
- https://learn.microsoft.com/en-us/typography/font-list/tahoma
- https://learn.microsoft.com/en-us/typography/font-list/arial
- https://learn.microsoft.com/en-us/typography/font-list/times-new-roman
- https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography (sections "Languages", "Fonts for non-Latin languages", "Sans-serif fonts", "Serif fonts", "Variable fonts")

### 1b. macOS and iOS (Apple)

Apple publishes inventories, not script coverage. The tags below are Apple's own ("iOS system font", "iOS downloadable", "macOS system font"). That a family named Geeza Pro or Damascus is an Arabic-script font is common knowledge and shows in the name list, but Apple's page does not say "Arabic", so the Arabic column is SECONDARY except where noted.

| CSS `font-family` | Shipped | Apple tag | Arabic glyphs | Confidence |
|---|---|---|---|---|
| `Geeza Pro` | macOS Sequoia and iOS | "iOS system font, macOS system font, tvOS, watchOS" (Regular, Bold) | Yes, by identity. WebKit's layout test expects Arabic text to fall back to Geeza Pro on macOS | Shipping: VERIFIED. Arabic: SECONDARY |
| `Damascus` | macOS and iOS | iOS system font, macOS system font (Regular, Light, Medium, Semi Bold, Bold) | Yes, by identity | Shipping: VERIFIED. Arabic: SECONDARY |
| `Al Nile` | macOS and iOS | iOS system font, macOS system font (Regular, Bold) | Yes, by identity | Shipping: VERIFIED. Arabic: SECONDARY |
| `Farah` | macOS and iOS | iOS system font, macOS system font (Regular) | Yes, by identity | Shipping: VERIFIED. Arabic: SECONDARY |
| `Al Bayan` | macOS; iOS on demand | iOS downloadable, macOS system font (Plain, Bold) | Yes, by identity | Shipping: VERIFIED. Arabic: SECONDARY |
| `Al Tarikh` | macOS; iOS on demand | iOS downloadable, macOS system font | Yes, by identity | Same |
| `Baghdad` | macOS; iOS on demand | iOS downloadable, macOS system font | Yes, by identity | Same |
| `Beirut`, `DecoType Naskh`, `Diwan Kufi`, `Diwan Thuluth`, `Farisi`, `KufiStandardGK` | macOS; iOS on demand | iOS downloadable, macOS system font | Yes, by identity | Same |
| `Muna`, `Nadeem`, `Noto Nastaliq Urdu`, `Sana`, `Waseem`, `Mishafi` | macOS | On the Sequoia list. Not found in the readable part of the iOS page | Yes, by identity | macOS shipping: VERIFIED. iOS: UNVERIFIED |
| `SF Arabic`, `SF Arabic Rounded` | **Not** on the Sequoia macOS list | Apple Fonts page: "SF script extensions"; "A contemporary interpretation of the Naskh style..."; offered as a download (`SF-Arabic.dmg`). WWDC22 session 110381 calls SF Arabic "the new Arabic system font" and says it is "available for download on the developer.apple.com website" | Yes (it is an Arabic font) | Download: VERIFIED. Preinstalled on a given OS: **UNVERIFIED**. Do not assume `SF Arabic` is resolvable by name in CSS |
| `Arial`, `Times New Roman`, `Tahoma`, `Verdana`, `Helvetica` on macOS | macOS | On the Sequoia list | Apple does not say | UNVERIFIED for Arabic on macOS. The Microsoft facts in 1a describe the Windows builds only |
| `SF Pro` | System UI font | Apple Fonts page: "SF Pro supports over 150 languages across Latin, Greek, and Cyrillic scripts." Arabic is not named. "Each script extension [SF Arabic, SF Armenian, SF Georgian, SF Hebrew] has been designed to fit with SF Pro for multilingual typesetting." | **No**, per Apple's script list | VERIFIED that Apple names only Latin, Greek and Cyrillic. Absence of a statement is not a statement of absence, so treat "SF Pro has no Arabic" as strongly implied, not quoted |

Sources:
- macOS Sequoia list (published 16 Sep 2024): https://support.apple.com/en-qa/120414
- iOS and macOS availability tags: https://developer.apple.com/fonts/system-fonts/ (truncated, see notes)
- SF Arabic and SF Pro scripts: https://developer.apple.com/fonts/
- WWDC22 "Meet the expanded San Francisco font family": https://developer.apple.com/videos/play/wwdc2022/110381/
- WebKit test (Arabic falls back to Geeza Pro): https://webkit.googlesource.com/WebKit/+/master/LayoutTests/fast/text/arabic-blocked-fonts.html (returned 403 to a direct fetch; the claim comes from a search snippet of that test, so SECONDARY)

### 1c. Android (AOSP)

Source: `frameworks/base/data/fonts/fonts.xml` on `main`. The file's header says it is deprecated and that third-party parsing is unsupported, so names may change between releases.

| CSS `font-family` / fonts.xml name | Arabic glyphs | Evidence | Confidence |
|---|---|---|---|
| `Noto Naskh Arabic` (`NotoNaskhArabic-Regular.ttf`, `-Bold.ttf`) | Yes | `lang="und-Arab"` family, variant `elegant` | VERIFIED that AOSP lists it as the `und-Arab` family. UNVERIFIED that Chrome on Android resolves the CSS name `Noto Naskh Arabic` to it |
| `Noto Naskh Arabic UI` (`NotoNaskhArabicUI-*.ttf`) | Yes | `lang="und-Arab"` family, variant `compact` | Same |
| `Roboto` | Not stated | fonts.xml maps `sans-serif` (plus aliases `arial`, `helvetica`, `tahoma`, `verdana`) to `Roboto-Regular.ttf`. Arabic is supplied by the separate `und-Arab` Noto entries | Roboto lacking Arabic is UNVERIFIED (implied by the separate fallback entries) |

Aliases from fonts.xml, VERIFIED but not Arabic evidence: `serif` is Noto Serif (aliases `times`, `georgia`, `palatino`), `monospace` is DroidSansMono (aliases `monaco`), `serif-monospace` is Cutive Mono (aliases `courier`, `courier new`). On Android these names are aliases to non-Arabic fonts, so a stack like `Tahoma, sans-serif` gets Roboto on Android and Arabic still arrives through fallback.

Source: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/data/fonts/fonts.xml

### 1d. ChromeOS

No vendor inventory of ChromeOS shipped fonts was found. The only primary evidence is Chromium's own Arabic locale file, which says which families Chrome names on ChromeOS.

| CSS `font-family` | Evidence | Confidence |
|---|---|---|
| `Roboto`, `Noto Sans Arabic UI` | `app_locale_settings_ar.xtb`, inside `<if expr="is_chromeos">`: `IDS_WEB_FONT_FAMILY` = "Roboto, Noto Sans Arabic UI, sans-serif" and `IDS_UI_FONT_FAMILY_CROS` = "Roboto, Noto Sans Arabic UI, 13px" | VERIFIED that Chromium names `Noto Sans Arabic UI` as the Arabic family for ChromeOS web content. UNVERIFIED that it is installed on every ChromeOS device or addressable from CSS |
| `Noto Naskh Arabic` | An old (2015-era) Chromium file named `Noto Naskh Arabic UI` as the Arabic fallback. The current file names `Noto Sans Arabic UI` instead | UNVERIFIED for current ChromeOS |

Source: https://chromium.googlesource.com/chromium/src/+/main/ui/strings/translations/app_locale_settings_ar.xtb?format=TEXT (base64 of the file, decoded in this session)

### 1e. `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`: do they render Arabic?

Plainly: **none of the three generic or alias keywords is an Arabic font family, and no rule may count them as one.** What happens to Arabic text under them is per-character fallback, which is a browser and OS behaviour, not a property of the keyword.

| Name | What the sources say | Renders Arabic by itself? | Confidence |
|---|---|---|---|
| `system-ui` | CSS Fonts 4: "The purpose of system-ui is to allow web content to integrate with the look and feel of the native OS." "The precise font(s) used will depend on factors such as platform support, platform language, locale settings" plus user preferences, Unicode coverage and content language. May be a composite font. No fixed per-script mapping. MDN: "the `lang` attribute may not affect the displayed font" | Platform dependent. Cannot be stated as yes or no | VERIFIED that the spec gives no guarantee |
| `-apple-system` | WebKit blog: works on iOS and OS X and gives access to San Francisco "on iOS 9 and OS X 10.11 and later"; on other browsers "the browser will simply fall back to the next item in the font-family fallback list". The post says nothing about Arabic or non-Latin | Resolves to SF (SF Pro). Apple lists SF Pro as Latin, Greek and Cyrillic. Arabic glyphs then come from fallback, which Safari does by content language | The alias-to-SF mapping: VERIFIED. Arabic via fallback: SECONDARY (WebKit test, WPT test `system-ui-ur-vs-ar.html` showing system-ui varies by `lang`) |
| `BlinkMacSystemFont` | Not mentioned on MDN or the WebKit post. Chromium's macOS alias for the same system font | Same as `-apple-system` | UNVERIFIED in this session (no primary source read) |
| `"Segoe UI"` | Microsoft: UI font for Arabic, and the family has Arabic glyphs (1a) | **Yes, on Windows** | VERIFIED. On macOS, iOS, Android and ChromeOS `Segoe UI` is not installed, so the stack moves to the next entry |
| `system-ui` on Windows | Not verified here whether Chrome or Edge maps it to `Segoe UI` or `Segoe UI Variable`. Microsoft says Segoe UI Variable is "the new system font for Windows" and that it lacks Arabic | Unknown | UNVERIFIED mapping. VERIFIED only that Segoe UI Variable has no Arabic |
| `system-ui` on Android and ChromeOS | Android default sans is Roboto (fonts.xml). ChromeOS Arabic web font list starts with Roboto | Arabic comes from the Noto `und-Arab` fallback | Mapping: SECONDARY. Fallback entries: VERIFIED |

Consequence for rules, stated once: a rule that says "this font-family stack has no Arabic-capable family" cannot be sound if it treats `system-ui`, `-apple-system`, `BlinkMacSystemFont` or `sans-serif` as lacking Arabic, because the browser still finds Arabic glyphs through fallback. A rule that says "this stack has an Arabic family" can be sound if it only accepts names from the VERIFIED rows (`Segoe UI`, `Tahoma`, `Arial`, `Times New Roman`, `Courier New`; Apple names only as SECONDARY).

Sources: https://drafts.csswg.org/css-fonts-4/#system-ui-def · https://developer.mozilla.org/en-US/docs/Web/CSS/font-family · https://webkit.org/blog/3709/using-the-system-font-in-web-content/ · https://searchfox.org/firefox-main/source/testing/web-platform/tests/css/css-fonts/system-ui-ur-vs-ar.html

---

## 2. CBUAE dirham sign guideline

The document is "Dirham Currency Symbol Guideline, Version 1.0", Central Bank of the UAE. The PDF metadata says created 21 May 2025. It is 29 pages. It states the symbol "has now been developed and must be used hereafter."

URL: https://www.centralbank.ae/media/jlhi41xu/dirham_currency_symbol_guideline_english.pdf

Quotes are verbatim from the PDF text. Page numbers are the footer numbers.

| Topic | Verbatim | Page | Confidence |
|---|---|---|---|
| Pairing with "AED" | "Never use the currency symbol and 'AED' together [dash in source] use one or the other, not both." (caption under the "Symbol vs Currency Code" Do/Don't, which shows "500" and "AED 500" as the Do examples against "AED  500" with the sign) | 11 | VERIFIED |
| Pairing with "AED" on price tags | "Use the currency symbol or the currency code (AED), but never both." | 19 | VERIFIED |
| Pairing with "Dh" | **Not in the document.** The strings "Dh" and "Dhs" do not occur | n/a | VERIFIED absence (searched the extracted text; the PDF also has images, whose text is not searched) |
| Pairing with the Arabic word or abbreviation | **Not in the document.** No Arabic text, "د.إ", or "درهم" appears. The word "Dirhams" appears only as below | n/a | VERIFIED absence |
| The word "Dirhams" in written amounts | Cheques: "In the 'amount in words' field, use the full phrase "Dirhams". The symbol should not be used on its own in written amounts to maintain legal clarity." Use cases: it "should never replace the full written form "Dirhams" when amounts are spelled out", and "Should NOT be used ... In place of "Dirhams" when writing amounts in words" | 15, 28 | VERIFIED |
| Position | "The symbol should be positioned to the left of the numeral." Digital: "the currency symbol must always be displayed to the left of the numerical value". Cheques, receipts and price tags: "immediately before", "directly before the numeric value" | 11, 15, 17, 19, 22 | VERIFIED |
| Spacing | "Sufficient space is required between the symbol and the numeral." No numeric gap is given for the symbol-to-numeral gap | 11 | VERIFIED |
| Direction | Do/Don't caption: "The direction of the symbol should match the direction of the text." The page shows images only, so the document does not explain RTL handling in words | 11 | VERIFIED text, but no RTL rule is spelled out. Do not build an RTL position rule on it |
| Size and baseline | "The height of the symbol should be equal to the height of the text." "the same height, baseline, and stroke weight as the numerals". Minimum "not appear smaller than 12px on screen or 5pt in print" ("Web Minimum Size: 12px"). "recommended minimum size of 12px for small devices" | 8, 11, 22 | VERIFIED |
| No superscript or subscript | "The symbol should not be stylised independently or appear in superscript/subscript forms." | 22 | VERIFIED |
| Colour | "primarily appear in black or white"; "Gradients, effects, and decorative alterations are not permitted." Brand colours "in marketing contexts only" | 9 | VERIFIED |
| Clear space | One-third of the symbol's height when used as a standalone graphic. "when used inline with text or numerical values, this clear space rule does not apply" | 8 | VERIFIED |
| Not a logo | "should not be used as a logo or branding element"; not on splash screens, headers or app branding | 28 | VERIFIED |
| Receipts | "All text on the receipt, including item names and headings, should appear in English only" | 17 | VERIFIED (physical and digital receipts) |
| Keyboard | Designated on the number 6 key, shift level, across all layouts | 13 | VERIFIED |
| Unicode or font encoding | **Not in the document.** It supplies EPS, PNG and SVG downloads only (page 29). No code point is mentioned | 29 | VERIFIED absence |

What a rule may safely say from this: pairing the symbol with the string `AED` in the same price is a documented violation, with two page citations. Pairing with `Dh` or with the Arabic word is **not** covered by the CBUAE document, so a rule on those pairings is the project's own convention and must not cite CBUAE. Placement "left of the numeral" is documented, and the document gives no separate RTL rule.

Secondary coverage (not used for any claim above): Gulf News and Property Finder summaries of the same guideline, found by search but not opened.

---

## 3. Unicode (UCD 18.0.0)

Read directly from `https://www.unicode.org/Public/18.0.0/ucd/DerivedAge.txt` (header: "DerivedAge-18.0.0.txt, Date: 2026-06-29") and `UnicodeData.txt` (HTTP 200, last-modified 1 Sep 2026). These match the GCC facts file (section 6) for the three GCC signs.

| Code point | Name (UnicodeData.txt) | Age (DerivedAge.txt) | gc | Bidi | Confidence |
|---|---|---|---|---|---|
| U+20C1 | SAUDI RIYAL SIGN | 17.0 | Sc | ET | VERIFIED |
| U+20C3 | UAE DIRHAM SIGN | 18.0 | Sc | ET | VERIFIED |
| U+20C4 | OMANI RIAL SIGN | 18.0 | Sc | ET | VERIFIED |
| U+FDFC | RIAL SIGN (decomposition `<isolated> 0631 06CC 0627 0644`, the Persian word ریال) | **3.2** | Sc | AL | VERIFIED |

(U+20C2 RUFIYAA SIGN is 18.0 and U+20C0 SOM SIGN is 14.0; both outside the GCC.)

**Correction to the GCC facts file.** Section 6 of `2026-10-19-gcc-facts.md` gives U+FDFC as age 4.0. DerivedAge-18.0.0.txt line `FDFC ; 3.2 # RIAL SIGN` says 3.2 (the neighbour U+FDFD is 4.0, which is probably where the 4.0 came from). The name, category and the advice (never use it as a SAR or Gulf fallback) are unchanged. The GCC file was not edited, because this task may write only this file. Whoever owns that file should correct 4.0 to 3.2. Also note the GCC file lists bidi ET for the three GCC signs only; U+FDFC is bidi class AL, which behaves differently in a mixed-direction run.

Sources: https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt · https://www.unicode.org/Public/18.0.0/ucd/DerivedAge.txt · `docs/research/2026-10-19-gcc-facts.md` section 6.

---

## 4. Screen readers and `lang`

Claim: a screen reader chooses pronunciation rules from the language of the text, so text marked `lang="ar"` is read with Arabic rules, and an English `aria-label` inside a `lang="ar"` element is read with Arabic rules unless it is marked otherwise.

Split into the parts the sources do and do not support.

| Part | Source and wording | Confidence |
|---|---|---|
| A screen reader picks pronunciation from the language of the text | WCAG 2.2 Understanding 3.1.2 Language of Parts: "Screen readers can use the pronunciation rules of the language of the text." Its German example: the screen reader "changes pronunciation rules from English to German to pronounce the word correctly." Intent: "This makes it possible for user agents and assistive technologies to present content according to the presentation and pronunciation rules for that language." | VERIFIED |
| `lang` is the mechanism, and the purpose is pronunciation | MDN `lang`: "The purpose of these requirements is primarily to allow assistive technologies such as screen readers to invoke the correct pronunciation." It names WCAG 3.1.1 and 3.1.2 and says `lang` is the correct mechanism | VERIFIED (MDN is secondary to W3C, but it quotes the SC requirement) |
| `lang` covers text-bearing attributes, not only content | HTML Standard, section 3.2.6.2: the `lang` attribute "specifies the primary language for the element's contents and for any of the element's attributes that contain text." That is the sentence as returned by the fetch; the surrounding text was not read in full | VERIFIED for the quoted clause. `aria-label` is not named in the passage; it is an attribute that contains text, so it falls under the clause by reading, not by explicit mention |
| An English `aria-label` inside `lang="ar"` is read with Arabic rules | Follows from the two rows above (the label inherits `lang="ar"`, and the screen reader uses the language of the text). No source states this exact case | **SECONDARY** (derived, not quoted) |
| **Caveat: assistive technology often ignores language changes in accessible names** | Same WCAG Understanding page: for accessible names, "changes in the natural language of content are not exposed to assistive technologies in these cases", and assistive technologies "won't switch pronunciation rules or voice/language packs for the specified language(s)." The page says this is caused by "limitations of user agents and assistive technologies" and does not count as a failure of 3.1.2 | VERIFIED |
| WCAG Understanding "Language of Page" | "Screen readers can load the correct pronunciation rules." (no mention of voice) | VERIFIED |

What this means for a rule. "Text in another language than its parent should carry its own `lang`" is supported (WCAG 3.1.2). "An `aria-label` in a different language than the surrounding `lang` is mispronounced" is only SECONDARY, and the WCAG page itself warns that screen readers often do not switch language for accessible names even when markup is correct. A rule here should therefore be advisory, should not claim the label will be read wrongly, and should not be a failure-level check.

Sources:
- https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html
- https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html
- https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
- WCAG 2.2 normative 3.1.2 text (`https://www.w3.org/TR/WCAG22/#language-of-parts`) was not readable in the fetch window, so the SC wording itself is not quoted here.

## 5. Chromium paint measurements for the bidi rules (Task 4)

Each row is a probe in `packages/rules/test/verify.test.ts`, measured per character in Chromium 140.0.7339.16 (Playwright) with and without `<bdi>`.

| Claim | Measurement | Test | Verdict |
|---|---|---|---|
| Three groups of Arabic-Indic digits are unchanged by isolation | `رقم ٠٥٠ ١٢٣ ٤٥٦٧` paints ٤٥٦٧ ١٢٣ ٠٥٠ left to right, bare and in `<bdi>` | `bidi/unisolated-number and three groups of Arabic-Indic digits` | VERIFIED (Chromium 140.0.7339.16 probe) |
| Plain emails, links, `www.` links and ORDER/INV codes paint the same with and without `<bdi>` in the measured positions | `hi@example.com`, `user.name+tag@mail.co.uk`, `https://example.com/a/b`, `www.example.com`, `ORDER-2041`, `INV_2041`: identical between Arabic words, at either end of the block, alone, before an Arabic full stop or question mark, before a Latin `.` `)` `,` or Arabic `،`, inside brackets, before an Arabic-Indic digit, after a digit group and a space, and with an Arabic word between token and digit | `bidi/unisolated-latin: only the shapes and positions that Chromium paints differently` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A leading `#` always differs | `#A-10293`, `#A10293`, `#FFF`, `#iPhone` differ in all 21 positions | `same test` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A trailing slash always differs | `https://example.com/a/b/` differs in all 21 positions; `/a/b` without the slash does not | `same test` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A Western or Extended Arabic-Indic digit after the token differs, and so does any digit directly before it | `{} 5`, `{} - 5`, `{}، 5`, `{} ۵` differ; `5{}` and `٥{}` differ; an Arabic-Indic digit after (`{} ٥`) and an Arabic word between token and digit do not | `same test` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A Latin neighbour changes the paint only by splitting one left-to-right phrase, so it is dropped | `تم hi@example.com Apple` bare paints h before A: the phrase reads in order | `bidi/unisolated-latin: does not treat a token that joins a neighbouring Latin word as scrambled` | VERIFIED (Chromium 140.0.7339.16 probe) |
| `#` before digits: Western and Extended Arabic-Indic digits differ only after Arabic text | `#10293`, `#12`, `#۵` differ after Arabic (also after a digit group, a full stop or a bracket that follows Arabic); the same at the block start, alone, after `(`, after a quote, after `. ` or after a Western digit with nothing before. After a Latin word the paint differs only by joining that phrase | `bidi/unisolated-number and a leading #` | VERIFIED (Chromium 140.0.7339.16 probe) |
| `#` before Arabic-Indic digits differs everywhere | `#٣٤٥` differs at the start, alone, in brackets, in quotes and after a full stop | `same test` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A closing mark before a `<br>` flips like the end of a paragraph | English line in an rtl block, and Arabic line in an ltr block, paint the mark at the line start; matching directions do not; an Arabic line ending in an English tag is correct | `bidi/punctuation-flip beyond the last run` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A mark inside `(AED)` before an inline `<b>` does not move | Parentheses paint around AED in order | `bidi/punctuation-flip beyond the last run: does not move a closing parenthesis inside an inline run` | VERIFIED (Chromium 140.0.7339.16 probe) |
| A mark ending an English phrase before Arabic flips mid-line, tagged or not (inline-run mark, dropped) | `<b>Hello world!</b> مرحبا` and `Hello world! مرحبا` both paint `!` left of Hello in an rtl block | `bidi/punctuation-flip beyond the last run: paints "!" at the start of an English phrase followed by Arabic` | VERIFIED (Chromium 140.0.7339.16 probe) |
| An Arabic placeholder in an ltr (or tel) input paints flush left | Ink spans 0.3% to 28% of the input width | `bidi/field-placeholder: an Arabic placeholder in a left-to-right field` | VERIFIED (Chromium 140.0.7339.16 probe) |
| `input:placeholder-shown { direction: rtl }` right-aligns the hint and leaves typed text ltr | Hint ink spans 71% to 99.7%; computed direction is rtl while empty and ltr after typing; a prefilled value paints flush left | `same describe` | VERIFIED (Chromium 140.0.7339.16 probe) |

---

## Tally

| Step | Verdict |
|---|---|
| 1 Windows | VERIFIED (Segoe UI, Tahoma, Arial, Times New Roman, Courier New, Calibri uprights, 8 FOD fonts) |
| 1 macOS and iOS | Shipping lists VERIFIED. Arabic coverage SECONDARY. SF Arabic preinstalled UNVERIFIED |
| 1 Android | AOSP `und-Arab` families VERIFIED. CSS addressability UNVERIFIED |
| 1 ChromeOS | Chromium font names VERIFIED. Shipped inventory UNVERIFIED |
| 1 system-ui and aliases | Not Arabic families: VERIFIED for spec wording, SECONDARY for per-OS mapping |
| 2 CBUAE | VERIFIED, quoted from the PDF. "Dh" and Arabic word pairing: VERIFIED absent |
| 3 Unicode | VERIFIED. One correction (U+FDFC age 3.2, not 4.0) |
| 4 Screen readers and `lang` | Language drives pronunciation: VERIFIED. English `aria-label` in `lang="ar"` case: SECONDARY, with a VERIFIED caveat against it |
| 5 Chromium bidi paint (Task 4) | VERIFIED, see the probes in `verify.test.ts` |
