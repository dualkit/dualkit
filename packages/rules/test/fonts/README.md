# Test fonts

IBM Plex Sans Arabic Regular (400) and Bold (700), woff2, unmodified, licensed under the SIL OFL 1.1 (see OFL.txt).

Source: npm package `@ibm/plex-sans-arabic` version 1.1.0 (https://registry.npmjs.org/@ibm/plex-sans-arabic/-/plex-sans-arabic-1.1.0.tgz, from https://github.com/IBM/plex), files `fonts/complete/woff2/IBMPlexSansArabic-Regular.woff2` and `IBMPlexSansArabic-Bold.woff2`.

`page()` in `../fixtures.ts` injects them as data: URLs so the fixture pages really load the font they name.

`CurrencySigns.woff` is a test-only font with glyphs for U+20C1, U+20C3 and U+20C4 and nothing else. No OFL font had U+20C1 on 20 Oct 2026 (Noto Sans 2.015 has U+20C0 only; Noto Sans Arabic, Noto Sans Symbols and Noto Sans Symbols 2 have none of U+20C1 to U+20C4), so `build-currency-font.py` draws it with fontTools. It is WOFF, not WOFF2, to avoid the Brotli dependency. Regenerate with `python3 build-currency-font.py`.
