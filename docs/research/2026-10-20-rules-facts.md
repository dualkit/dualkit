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

## 6. Currency signs in webfonts (Task 5 fix round)

Probes in `packages/rules/test/verify.test.ts`, Chromium via Playwright, widths at 48px.

| Claim | Measurement | Test | Verdict |
|---|---|---|---|
| IBM Plex Sans Arabic 1.1.0 (default unicode-range) has no glyph for U+20C1, U+20C3 or U+20C4 | U+20C3 and U+20C4 advance 22.66, the same as unassigned U+0378 (the face's missing-glyph box). U+20C1 advances 25.86, equal to a plain sans-serif stack: a system font drew it, not the face | `currency signs in IBM Plex Sans Arabic` | VERIFIED (Chromium probe) |
| A default unicode-range says nothing about glyphs | The Plex face declares `U+0-10FFFF` and still lacks the signs | same test | VERIFIED |
| A webfont that has the sign is told apart by width: the sign in the family alone differs from U+0378 in that family and from the sign in plain sans-serif (0.5px tolerance) | Test font `CurrencySigns.woff` (glyph 700 units, .notdef 500) records true for U+20C1, U+20C3, U+20C4 with no unicode-range; Plex records false | `content/currency-sign-font measures the webfont` | VERIFIED (Chromium probe) |
| No OFL font had U+20C1 on 20 Oct 2026 | Google Fonts repository files checked with fontTools: Noto Sans 2.015 has U+20C0 only; Noto Sans Arabic 2.012, Noto Sans Symbols 2.003 and Noto Sans Symbols 2 2.008 have none of U+20C1 to U+20C4. Apple system fonts (SF) have U+20C1 but are not redistributable | `test/fonts/build-currency-font.py` | VERIFIED (checked files) |

Known blind spot: a webfont whose sign is exactly as wide as the system fallback glyph would read as not drawn.

## 7. Mirrored and clipped text (Task 6)

Probes in `packages/rules/test/verify.test.ts`, Chromium 140.0.7339.16 via Playwright 1.55, 1024px viewport.

| Claim | Measurement | Test | Verdict |
|---|---|---|---|
| Arabic text under `scaleX(-1)` paints as its mirror image | In a 300px box the plain ink spans 0.813 to 0.997 of the width; with one flip it spans 0.003 to 0.187, exactly the mirror about the centre; the screenshots differ | `layout/mirrored-text matches what Chromium paints` | VERIFIED (Chromium probe) |
| Two flips (nested `scaleX(-1)`, or `scale: -1 1` over a `transform`) paint the original | Ink spans 0.813 to 0.997 again, equal to the plain text. Pixels are not byte-identical (transformed layers antialias differently), so the probe compares the ink extent | same | VERIFIED. The reader multiplies the signs, so a double flip is not reported |
| An Arabic button label wider than its fixed box paints past the edge and is cut | A 60px `overflow:hidden; white-space:nowrap` button: the characters reach 82.0px past the box edge; `scrollWidth - clientWidth` is 90px for a similar box | `an Arabic button label wider than its fixed box` | VERIFIED (Chromium probe) |
| A one-line Arabic label at `line-height: 1` in an `overflow:hidden; height:1em` box loses ink below | At 20px: 44 dark pixels paint below the box with `overflow:visible` and 0 with `overflow:hidden`. The reader reports 5px (the smaller of `scrollHeight - clientHeight` and how far the painted text boxes reach past the padding box, both 5px here) because the IBM Plex Sans Arabic line box is 25px against the 20px box | `a one-line label at line-height 1 in a 1em box` | VERIFIED (Chromium probe) |
| A box that scrolls only for an oversized image has no clipped text (fix round 1) | An `overflow:hidden` 200px card holding a 600px image and a short caption: the text boxes stay inside the padding box, no finding; the reader requires both the scroll gap and the text reach | `reads no clip when the box scrolls for an oversized image` in `reader.test.ts` | VERIFIED (Chromium) |
| Ink that sticks out of a box whose line box still fits is not counted in `scrollHeight` | Not probed as a rule input: the rule relies on line boxes, and the limit is stated in RULES.md | none | NOT CLAIMED. Listed under Known limits |
| `text-overflow: ellipsis`, `overflow: auto` and an `.sr-only` box are not clipped text | The rule stays quiet for all three | `stays quiet for an ellipsis, a scrolling container, and an .sr-only label` | VERIFIED |

## 8. Arabic words split across inline elements (Task 7)

Probes in `packages/rules/test/verify.test.ts` (`type/arabic-broken-join matches what Chromium paints`), Chromium 140.0.7339.16 via Playwright 1.55, 16px IBM Plex Sans Arabic. The brief's example `مر` + `حبا` cannot test a join, because reh joins to nothing on its left, so the probe uses `محمد` split as `مح` + `مد`: the heh joins to the following meem. Joined, heh paints medial and meem medial. Broken, heh paints final and meem initial. Each case is classified against reference words set in the same style (glyph box widths in px, from `Range.getClientRects`).

Plain `محمد`: م 7.73, ح 10.63 (medial), م 8.41 (medial), د 8.5. `مح` alone: ح 10.28 (final). `مد` alone: م 7.75 (initial).

| Case on the `مد` span | ح width | م width | Verdict |
|---|---|---|---|
| `<b>` (font-weight 700) | 10.61 | 9.75 (bold medial 9.75, bold initial 8.23) | JOINS |
| colour only | 10.61 | 8.41 | JOINS |
| `display:inline-block` | 10.28 | 7.75 | BREAKS |
| `display:inline-flex` | 10.28 | 7.75 | BREAKS |
| `font-family`: Plex Bold loaded as its own family (different bytes) | 10.61 | 9.75 (bold medial) | JOINS |
| `font-family: serif` | 10.61 | 7.05 (initial and medial identical) | UNCERTAIN: the fallback draws the same form everywhere |
| `padding-inline-start: 2px` | 10.61 | 8.41 | JOINS |

A font-family change is platform-dependent, so the rule measures it in the page. Probes on this machine (macOS, system fonts, same Chromium and Playwright):

| Pair | Boundary letter painted | Joined form | Split form | Verdict |
|---|---|---|---|---|
| Geeza Pro, then Plex | 8.38 (م, second span, Plex 16px) | 9.84 | 8.38 | BREAKS |
| Plex, then Al Nile | 5.05 (م, second span, Al Nile 16px) | 6.73 | 5.05 | BREAKS |

An earlier version of this section claimed a font change never breaks the join. That was wrong, and it came from a probe bug: the case styles were written with double quotes inside a double-quoted `style` attribute, so the font-family never applied. A reviewer's macOS probe at a larger size found the same breaks: Plex to Al Nile leaves the م initial (10.09; Nile initial 10.09, medial 13.45), Geeza Pro to Plex leaves the ح final (16.73; Geeza medial 19.67, final 16.73), and Plex Regular to Plex Bold as different families with different bytes joins (19.47 = Bold medial). Those numbers came from a macOS probe, not from the Linux CI fonts, so the result depends on the installed fonts and the reader measures it per page. ZWJ alone is not a reliable reference: Al Nile breaks the run at U+200D, so the reader falls back to the real neighbouring letter drawn in that font when the ZWJ forms are within 0.5px.

The rule reports `inline-block` and `inline-flex` always, and a font-family change only when the measured boundary letter is nearest the non-joining form and the two reference forms differ by more than 0.5px. `inline-grid` and `inline-table` were not probed and are not reported.

## 9. Final branch review fixes

Probes in `packages/rules/test/joins-boxes.test.ts`, `flips.test.ts`, `clips.test.ts`, `fonts-measured.test.ts` and `verify.test.ts`, plus a scratch probe that printed the raw numbers below. Chromium 140.0.7339.16 via Playwright 1.55, 1024px viewport, 16px IBM Plex Sans Arabic unless noted. The reviewer's page cases are kept as regression tests.

### 9a. Split words need one line of inline content

The earlier dogfood ruling kept flex items as breaks. The final review overrules it: two text nodes are a candidate only when every element from each up to their common ancestor is inline-level (inline, inline-block, inline-flex, inline-grid or contents), the common ancestor does not blockify its children (flex or grid), and the two boundary letters sit on one line with a horizontal gap under 1px.

| Case | Boundary gap | Same line | Verdict |
|---|---|---|---|
| `مح` + unpadded inline-block `مد` | 0px | yes | REPORTED (kept) |
| `مح` + unpadded inline-flex `مد` | 0px | yes | REPORTED (kept) |
| Geeza Pro `مح` then Plex `مد`, inline spans | 0px | yes (tops 3px apart, rects overlap) | REPORTED (kept, macOS) |
| Inline `li` + inline-block `a`, padding 8px | 16px | yes | QUIET (gap) |
| Padded inline-flex tabs, padding 8px | 16px | yes | QUIET (gap) |
| Badge, inline-flex with margin-inline-start 8px | 8px | yes | QUIET (gap) |
| Table cells with inline-block spans | 4px | yes | QUIET (table-cell on the path, and the gap) |
| Block `li` items | 37.5px | no (27px apart) | QUIET (list-item on the path) |
| `h2` in Geeza Pro then `p` | 80.9px | no | QUIET (block on the path) |
| Two adjacent divs in different fonts | n/a | no | QUIET (block on the path) |
| Flex items in a row | n/a | n/a | QUIET (the common ancestor is a flex container) |
| Hijri `هـ` beside an inline-block label | n/a | n/a | QUIET (tatweel) |
| The same word wrapped across two lines at the box | n/a | no | QUIET |

The join probe now copies the measured text's computed letter-spacing. Between 0 and 0.4em of letter-spacing the verdicts were the same with the old forced 0 and with the copied value (Geeza Pro then Plex and Plex then Al Nile report, Plex Regular then Plex Bold stays quiet), so this keeps the reference forms in the same style without changing a measured result.

### 9b. A flip is a negative determinant

| Style | Computed value | a | a·d − b·c | Mirrors |
|---|---|---|---|---|
| `transform: scaleX(-1)` | `matrix(-1, 0, 0, 1, 0, 0)` | -1 | -1 | yes |
| `transform: rotate(180deg)` | `matrix(-1, 0, 0, -1, 0, 0)` | -1 | 1 | no, it turns |
| `transform: scale(-1,-1)` | `matrix(-1, 0, 0, -1, 0, 0)` | -1 | 1 | no, it turns |
| `rotate: 180deg` (Tailwind v4 rotate-180) | `rotate: 180deg`, transform none | -1 | 1 | no, it turns |
| `scale: -1` | `scale: -1` | -1 | 1 | no, it turns |
| `scale: -1 1` and `scale: -100% 100%` | `scale: -1 1` | -1 | -1 | yes |
| `transform: rotateY(180deg)` | `matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)` | -1 | -1 | yes |
| `transform: scaleY(-1)` | `matrix(1, 0, 0, -1, 0, 0)` | 1 | -1 | yes |

The old reader read only `a`, so it called every row with a = -1 a flip and missed scaleY(-1). It also ignored the `rotate` property, so a Tailwind v4 `rtl:rotate-180` chevron read as not mirrored. Mirrored text now needs Arabic letters, so a flipped `→` glyph and a flipped material-icons `arrow_forward` ligature are left to the icon rules. Icons record `turned` (a positive determinant with a < 0), and icons/not-mirrored accepts a turned icon. A flipped play icon still fires icons/mirrored-by-mistake; a turned one does not.

### 9c. Clipped text ignores runs outside the box, and line-clamp is an ellipsis

| Case | Box (x) | Text runs (x) | Scroll gap | Verdict |
|---|---|---|---|---|
| 900px flex track in a 300px box | 716 to 1016 | 933 to 1016 (inside), 630 to 716 and 330 to 416 (wholly outside) | 600px | QUIET (old: 383px reported) |
| Swiper-style track moved by `translate3d(300px,0,0)` | 716 to 1016 | 930 to 1016 (inside), 1233 to 1316 and 630 to 716 (outside) | 300px | QUIET |
| Track moved 50px so one run straddles the edge | | | | REPORTED |
| Tailwind line-clamp-2 in a 200px box | | four lines, two kept | 55px down | QUIET: computed `-webkit-line-clamp` is `2`, counted as an ellipsis (old: 41px reported) |
| "Read more" box, `max-height: 48px` | | | | REPORTED, listed under Known limits |

### 9d. Brand Arabic webfonts are measured

Alef (U+0627) at 48px, with the face loaded as "Brand Sans" and the default unicode-range:

| Face | Alef in `"Brand Sans",sans-serif` | U+0378 in the same stack | Alef in sans-serif | Alef in `"Brand Sans",serif` | Alef in serif | drawsArabic |
|---|---|---|---|---|---|---|
| IBM Plex Sans Arabic bytes | 10.77 | 22.66 | 14.05 | 10.77 | 14.05 | true |
| CurrencySigns.woff (no Arabic) | 14.05 | 24 | 14.05 | 14.05 | 14.05 | false |

The rule passes the Plex bytes under "Brand Sans", "GE SS Two" and "HelveticaNeueW23", and fails the Latin-only face. A name that says Arabic, an explicit range, and a face that is not loaded are not measured (drawsArabic is null). The probe never throws and is removed in finally.

### 9e. Where the placeholder lands

| Field (`dir="ltr"`, 300px) | Field text-align | ::placeholder text-align | Hint ink | Verdict |
|---|---|---|---|---|
| plain | start | start | 0.3% to 28% | REPORTED |
| `text-align: right` on the field | right | right | 71.3% to 99.7% | QUIET |
| `::placeholder { text-align: right }` | start | right | 71.3% to 99.7% | QUIET |
| `::placeholder { text-align: end }` | start | end | 71.3% to 99.7% | QUIET (end resolves to right in an ltr field) |
| `::placeholder { text-align: start }` | start | start | flush left | REPORTED |

The rule now also needs a right-to-left page.

### 9f. The hidden face of a flip card is not painted

A 200 by 100px card under `perspective:600px` with `transform-style:preserve-3d`. Both faces are absolutely placed with `backface-visibility:hidden`; the back face (blue) carries `rotateY(180deg)`, the front face is red. Counted pixels in a screenshot of the card:

| Card | Front face pixels | Back face pixels | mirrored-text before | after |
|---|---|---|---|---|
| Not turned | 576 | 0 | REPORTED on the back face | QUIET |
| Turned (`rotateY(180deg)` on the card) | 0 | 549 | REPORTED on the front face | QUIET |
| Back face under `rotateY(180deg)` without `backface-visibility:hidden` | | | REPORTED | REPORTED |

The reader now skips a run when an element on its chain, up to and including the farthest flip, has `backface-visibility:hidden` and the product of the flip signs from that element up is negative. On the turned card the back face's own flip cancels the card's, so it is not mirrored, and the front face shows its back, so it is hidden.

### 9g. Text in a translated track is a mask

A 300px `overflow:hidden` box over a `display:flex; width:max-content` track of two 250px slides, the second peeking in. Before, the peeking slide read as 124px of text cut off sideways. A run is now dropped from the gap when an element between it and the clip box, not counting the clip box itself, moves by a translate: the `translate` property, or a `transform` with a translation or an identity linear part (Swiper and Embla leave a track at rest at `translate3d(0,0,0)`).

| Case | Verdict |
|---|---|
| Track with `translateX(50px)`, `translate3d(-40px,0,0)`, `translate:30px` or `translate3d(0,0,0)` | QUIET |
| Same track with no transform at all (the reviewer's `peek-carousel` page) | REPORTED, 124px. Nothing on the page says it is a carousel; a too-wide row looks the same |
| 60px Arabic button whose label runs past it | REPORTED |
| The same button with its own `translateY(-2px)` or `translate(0,0)` | REPORTED (the clip box moves with its text) |
| The same button inside a `rotate(2deg)` box | REPORTED |

---

## 10. Source rules (Part B)

Checked 20 Oct 2026. Tailwind facts come from the Tailwind CHANGELOG (`CHANGELOG.md` on `main`, which lists 4.3.3 of 16 Jul 2026 as the latest release), the v3.3 blog post, the current docs, and the `src/corePlugins.js` file at the git tags `v3.0.0`, `v3.2.7`, `v3.3.0` and `v3.4.0`. "Added in" is the first release whose changelog or tagged source contains the class.

### 10a. Tailwind physical to logical classes (feeds `TAILWIND_MAP`)

| Physical family | Logical replacement | Added in | Source | Confidence |
|---|---|---|---|---|
| `ml-*` | `ms-*` (`margin-inline-start`) | 3.3.0 | blog table; `v3.3.0` source line `['ms', ['margin-inline-start']]`; changelog "Add logical properties support for inline direction" (#10166) | VERIFIED |
| `mr-*` | `me-*` (`margin-inline-end`) | 3.3.0 | same | VERIFIED |
| `pl-*` | `ps-*` (`padding-inline-start`) | 3.3.0 | blog table; `v3.3.0` source | VERIFIED |
| `pr-*` | `pe-*` (`padding-inline-end`) | 3.3.0 | same | VERIFIED |
| `left-*` | `start-*` (3.3.0), then `inset-s-*` (4.2.0) | `start-*` 3.3.0; `inset-s-*` 4.2.0 | blog table; `v3.3.0` source `['start', ['inset-inline-start']]`; 4.2.0 changelog "Add `inset-s-*`, `inset-e-*`, `inset-bs-*`, `inset-be-*` utilities" (#19613) and "Deprecate `start-*` and `end-*` utilities in favor of `inset-s-*` and `inset-e-*` utilities". Current docs (`/docs/top-right-bottom-left`) document only `inset-s-*` | VERIFIED. Which name to suggest depends on the project's Tailwind major and minor; see the note below |
| `right-*` | `end-*` (3.3.0), then `inset-e-*` (4.2.0) | `end-*` 3.3.0; `inset-e-*` 4.2.0 | same | VERIFIED |
| `text-left` | `text-start` (`text-align: start`) | 3.1.0 | changelog 3.1.0 "Add `text-start` and `text-end` utilities" (#6656); `v3.2.7` source has `.text-start`; `v3.0.0` source does not. Docs `/docs/text-align` | VERIFIED |
| `text-right` | `text-end` (`text-align: end`) | 3.1.0 | same | VERIFIED |
| `rounded-l-*` | `rounded-s-*` | 3.3.0 | blog table; `v3.3.0` source `['rounded-s', [...]]`; docs `/docs/border-radius` | VERIFIED |
| `rounded-r-*` | `rounded-e-*` | 3.3.0 | same | VERIFIED |
| `rounded-tl-*` | `rounded-ss-*` | 3.3.0 | blog table; `v3.3.0` source | VERIFIED |
| `rounded-tr-*` | `rounded-se-*` | 3.3.0 | same | VERIFIED |
| `rounded-bl-*` | `rounded-es-*` | 3.3.0 | same | VERIFIED |
| `rounded-br-*` | `rounded-ee-*` | 3.3.0 | same | VERIFIED |
| `border-l`, `border-l-*` | `border-s`, `border-s-*` | 3.3.0 | blog table; `v3.3.0` source `['border-s', ...]`; docs `/docs/border-width` | VERIFIED |
| `border-r`, `border-r-*` | `border-e`, `border-e-*` | 3.3.0 | same | VERIFIED |
| `float-left` | `float-start` (`float: inline-start`) | 3.4.0 | changelog 3.4.0 "Add logical property values for `float` and `clear` utilities" (#12480); `v3.3.0` source has no `float-start`, `v3.4.0` source has `.float-start` and `.float-end`; docs `/docs/float` | VERIFIED |
| `float-right` | `float-end` (`float: inline-end`) | 3.4.0 | same | VERIFIED |
| `scroll-ml-*` | `scroll-ms-*` | 3.3.0 | blog table; `v3.3.0` source `['scroll-ms', ...]` | VERIFIED |
| `scroll-mr-*` | `scroll-me-*` | 3.3.0 | same | VERIFIED |
| `scroll-pl-*` | `scroll-ps-*` | 3.3.0 | same | VERIFIED |
| `scroll-pr-*` | `scroll-pe-*` | 3.3.0 | same | VERIFIED |
| `clear-left`, `clear-right` | `clear-start`, `clear-end` | 3.4.0 | same changelog line (#12480); `v3.4.0` source `.clear-start`. Not in the spec's family list; recorded in case Task 4 wants it | VERIFIED |

**First release with logical utilities overall.** The first class in the table above is `text-start` and `text-end` in 3.1.0 (8 Jun 2022). The first release of the margin, padding, inset, border-radius, border-width and scroll families is 3.3.0 (27 Mar 2023). The belief "logical utilities first appeared in 3.3" is right for those families and wrong for `text-start`/`text-end` (3.1.0) and `float-start`/`float-end`/`clear-start`/`clear-end` (3.4.0). The v3.3 blog post says "We've added new logical property utilities for inset, margin, padding, border-radius, scroll-margin, and scroll-padding", and the tagged 3.3.0 source also carries `border-s` and `border-e`.

**Newer names, 4.2.0.** `inset-s-*` and `inset-e-*` replace `start-*` and `end-*` (deprecated, same release). 4.2.0 also adds block-axis names (`inset-bs-*`, `inset-be-*`, `pbs-*`, `pbe-*`, `mbs-*`, `mbe-*`, `border-bs-*`, `border-be-*`, `scroll-pbs-*` and others, #19601 and #19613). These are block (top and bottom) names, so they replace `top-*` and friends, not the horizontal families this rule covers. 4.2.3 teaches the upgrade tool to rewrite `start-<n>` to `inset-s-<n>` and `end-<n>` to `inset-e-<n>` (#19849). 4.3.0: "Ensure `start` and `end` legacy utilities without values do not generate CSS" (#20003).

**Fix text for `left-*` and `right-*`.** Suggest `start-*`/`end-*` for Tailwind below 4.2 and `inset-s-*`/`inset-e-*` for 4.2 and later. If the installed version is unknown, name both. Neither `start-*` nor `end-*` was removed; they are deprecated.

**What is not covered.** `ml-auto`, `mr-auto`, `space-x-*` and `divide-x-*` are not in the spec list and have no entry. Tailwind used logical properties for `space` and `divide` in 2.0.0-alpha.1 (#1883) and reverted that in 2.0.0-alpha.2 (#2644), per the changelog, so do not claim a logical replacement for them.

Sources:
- https://tailwindcss.com/blog/tailwindcss-v3-3 (section "Simplified RTL support with logical properties")
- https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/CHANGELOG.md (entries 3.1.0, 3.3.0, 3.4.0, 4.2.0, 4.2.3, 4.3.0)
- https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.3.0/src/corePlugins.js, `v3.2.7`, `v3.4.0`, `v3.0.0` (same path)
- https://tailwindcss.com/docs/text-align, /docs/border-radius, /docs/border-width, /docs/float, /docs/top-right-bottom-left

### 10b. CLDR default numbering system for Arabic locales (feeds `intl-digits`)

Local probe, `new Intl.NumberFormat(locale).resolvedOptions().numberingSystem`:

| Runtime | CLDR | ICU | `ar` | `ar-AE` | `ar-SA` | `ar-EG` | `ar-MA` |
|---|---|---|---|---|---|---|---|
| Node 18.20.8 (`npx -y node@18`) | 44.1 | 74.2 | arab | latn | arab | arab | latn |
| Node 20.20.2 (`npx -y node@20`) | 48.0 | 78.2 | latn | latn | arab | arab | latn |
| Node 22.21.1 (nvm) | 47.0 | 77.1 | latn | latn | arab | arab | latn |
| Node 25.6.1 (default `node`) | 48.0 | 78.2 | latn | latn | arab | arab | latn |

Node 20 reports CLDR 48 because the 20.20.2 build ships a newer ICU than early Node 20 releases did. The CLDR column is `process.versions.cldr` as printed, not assumed from the major version.

CLDR source data, the `<defaultNumberingSystem>` element in `common/main/<locale>.xml` at the git tag `release-<n>` of `unicode-org/cldr`. The symbol `↑↑↑` means "inherit from the parent locale", which for `ar` is root, whose default is `latn`:

| Locale | r42 | r44.1 | r45 | r46 | r47 | r48 |
|---|---|---|---|---|---|---|
| `ar` | arab | arab | arab | inherits (latn) | inherits (latn) | inherits (latn) |
| `ar-AE` | latn | latn | latn | inherits `ar` (latn) | same | same |
| `ar-SA` | arab | inherits `ar` (arab) | inherits `ar` (arab) | arab | arab | arab |
| `ar-EG` | arab | inherits `ar` (arab) | inherits `ar` (arab) | arab | arab | arab |
| `ar-MA` | latn | latn | latn | inherits `ar` (latn) | same | same |

| Claim | Confidence |
|---|---|
| CLDR changed the default digits for the generic `ar` locale from `arab` (Arabic-Indic) to `latn` between release 45 and release 46. Evidence: the `ar.xml` data at `release-45` says `arab`, at `release-46` it inherits root. The local probe agrees (Node 18 with CLDR 44.1 gives `arab`; the later runtimes give `latn`) | VERIFIED from the CLDR data and the local probe |
| `ar-SA` and `ar-EG` keep `arab` in every release checked (42 to 48); `ar-AE` and `ar-MA` are `latn` in every release checked | VERIFIED |
| A CLDR ticket or release-note sentence announcing the `ar` change | UNVERIFIED. The CLDR 46 release page (`cldr.unicode.org/downloads/cldr-46`) was read and does not mention it. A 2019 cldr-users thread discusses switching Arabic to ASCII digits but is a proposal, not the change. Do not cite a ticket |
| `ar-AE` and `ar-MA` were `latn` in Node 18 | VERIFIED by the local probe |

Consequence for the rule's `why`: say that the default digits for a bare `ar` depend on the runtime's CLDR version (Arabic-Indic before CLDR 46, Latin from 46) and that `ar-AE`, `ar-MA` and others differ from `ar-SA` and `ar-EG`, so the code should pin `numberingSystem`. Do not cite a ticket. CLDR 44.1 is inferred for Node 18 only from `process.versions.cldr` and the probe; the Node release notes were not read.

Sources: https://raw.githubusercontent.com/unicode-org/cldr/release-45/common/main/ar.xml and `release-46`, `release-47`, `release-48`, plus the `ar_AE`, `ar_SA`, `ar_EG`, `ar_MA` files at each tag · https://cldr.unicode.org/downloads/cldr-46 · https://corp.unicode.org/pipermail/cldr-users/2019-April/000918.html

### 10c. Islamic calendar ids and Saudi Arabia

| Claim | Source | Confidence |
|---|---|---|
| The valid CLDR calendar types for the Hijri family are `islamic`, `islamic-civil`, `islamic-rgsa`, `islamic-tbla`, `islamic-umalqura`. The legacy `islamicc` is deprecated with `preferred="islamic-civil"` | `common/bcp47/calendar.xml` at `release-48`: `islamic` "Hijri calendar", `islamic-umalqura` "Hijri calendar, Umm al-Qura", `islamic-tbla` "tabular ... astronomical epoch", `islamic-civil` "tabular ... civil epoch", `islamic-rgsa` "Saudi Arabia sighting" | VERIFIED |
| ECMA-402 identifies calendars by the UTS 35 calendar type and does not list the ids itself. `AvailableCalendars` is implementation-defined and "must include `iso8601`"; the spec names `islamicc` and `islamic-civil` as aliases that are both or neither supported | `tc39/ecma402` `spec/locales-currencies-tz.html`, clause `sec-calendar-types` | VERIFIED |
| Node 25.6.1 `Intl.supportedValuesOf('calendar')` returns `islamic islamic-civil islamic-rgsa islamic-tbla islamic-umalqura` (plus the non-Hijri calendars) | local probe | VERIFIED for that runtime only |
| CLDR calendar preference for `SA` is `gregorian islamic-umalqura islamic islamic-rgsa`; for `AE BH KW QA` it is `gregorian islamic-umalqura islamic islamic-civil islamic-tbla`; for `EG` it is `gregorian coptic islamic islamic-civil islamic-tbla` | `common/supplemental/supplementalData.xml` `calendarPreferenceData` at `release-48` | VERIFIED |
| `new Intl.DateTimeFormat('ar-SA').resolvedOptions().calendar` is `gregory` in Node 25.6.1, so a bare `ar-SA` formatter does not produce Hijri dates by default; `ar-AE` and `ar-EG` are also `gregory` | local probe | VERIFIED. Hijri output needs `calendar: 'islamic-umalqura'` or the `-u-ca-` extension |
| Saudi Arabia officially uses the Umm al-Qura calendar for civil dates | The CLDR preference above ranks `islamic-umalqura` first of the Hijri calendars for `SA`, and the site title `ummulqura.org.sa` reads "Official Umm al-Qura Calendar". A web search found papers saying the Umm al-Qura calendar is used by the Saudi government for civil purposes and is developed at KACST. No government or KACST page stating it was read | SECONDARY. Not VERIFIED, because no primary government statement was read. A rule may use the CLDR preference (VERIFIED) but must not say "officially" |

Sources: https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/bcp47/calendar.xml · https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml · https://raw.githubusercontent.com/tc39/ecma402/main/spec/locales-currencies-tz.html · https://www.ummulqura.org.sa/ · https://proceedings.uinsa.ac.id/index.php/ICOSLAW/article/view/947

### 10d. U+FDFC in HTML source

U+FDFC is already VERIFIED in section 3 (RIAL SIGN, age 3.2, gc Sc, bidi AL). Not redone here.

| Claim | Confidence |
|---|---|
| `&#xFDFC;`, `&#xfdfc;` and `&#65020;` are all valid numeric character references to U+FDFC (hex digits are case-insensitive; 0xFDFC is 65020 decimal, computed) | VERIFIED (arithmetic checked; the character-reference syntax is the standard HTML numeric form) |
| There is no named character reference for U+FDFC. `https://html.spec.whatwg.org/entities.json` (2231 entries, last-modified 12 Nov 2025) has no entry whose `codepoints` contains 0xFDFC | VERIFIED by a script over the file |

Source: https://html.spec.whatwg.org/entities.json

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
| 6 Currency signs in webfonts (fix round) | VERIFIED, see the probes in `verify.test.ts` |
| 7 Mirrored and clipped text (Task 6) | VERIFIED, see the probes in `verify.test.ts`. Dot-below ink beyond the line box is a stated limit |
| 8 Split Arabic words (Task 7) | VERIFIED: inline-block and inline-flex break; b, colour and padding join. Font-family is platform-dependent (breaks with Geeza Pro and Al Nile on macOS, joins between Plex faces) and is measured per page. Serif fallback UNCERTAIN, not claimed |
| 9 Final review fixes | VERIFIED, see the probes in `joins-boxes`, `flips`, `clips`, `fonts-measured` and `verify` tests. A read-more box with max-height is a stated limit. Flip card back faces (9f) and translated tracks (9g) measured; an untranslated over-wide track still reports |
| 10 Source rules (Part B) | Tailwind logical classes and versions VERIFIED (3.1.0 text-start, 3.3.0 ms/me/ps/pe/start/end/rounded/border/scroll, 3.4.0 float/clear, 4.2.0 inset-s/inset-e). CLDR `ar` digits arab to latn between r45 and r46 VERIFIED from data; no CLDR ticket (UNVERIFIED). Islamic calendar ids VERIFIED. "Saudi officially uses Umm al-Qura" SECONDARY. No named entity for U+FDFC VERIFIED |
