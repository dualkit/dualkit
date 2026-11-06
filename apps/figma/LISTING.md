# Figma Community listing (draft)

**Name:** Dualkit

**Tagline:** Check Arabic text in a frame and fill layers with valid Gulf sample data.

**Description:**

Dualkit checks the text in a Figma frame for problems that show up when Arabic and English share a screen, and fills text layers with Gulf sample data that passes validation.

Check frame runs 16 rules from the open-source Dualkit rules package on the selected frame. It looks for Arabic set in a font with no Arabic in its name, Arabic body text with line height below 1.45, letter-spacing on Arabic, slanted or very small Arabic, phone numbers, codes and dash-joined dates that will show in the wrong order inside Arabic text, two digit systems on one screen, Latin commas in Arabic, currencies written before their number, placeholder text, and Arabic aligned left in a fixed-width box. Each finding has a one-sentence fix and a link to the pattern. Click a finding to jump to its layer.

Some rules need the built page, such as missing lang or dir attributes, CSS that does not mirror, and icons. The plugin lists those as not checked in Figma, so you know what to check in code.

Fill Gulf samples replaces the text of the selected layers with UAE and Saudi phone numbers, UAE and Saudi IBANs, Emirates IDs, amounts in AED, SAR and KWD, and Gregorian and Hijri dates, in English or Arabic, with Western or Arabic-Indic digits. Phone numbers, IBANs and Emirates IDs pass the validators in @dualkit/format. Pick a seed to get the same samples again. The values are made up and are for mockups only.

The plugin makes no network requests. It is free and open source under the MIT licence: github.com/dualkit/dualkit

**Tags:** arabic, rtl, bilingual, gulf, accessibility, lint, sample data

**Icon:** `assets/icon-128.png`
