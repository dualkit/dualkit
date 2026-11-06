# Hijri audit: toHijri against the official Umm al-Qura table

Date: 2026-11-06

## Question

`@dualkit/format`'s `toHijri` reads ICU's `islamic-umalqura` calendar through `Intl.DateTimeFormat`. A secondary source claimed that browser Hijri dates are a day off in many months around 2030 to 2044. We checked that claim against the official calendar before deciding whether `hijri.ts` needs a correction table.

## Source

The primary source is the Umm al-Qura calendar published by King Abdulaziz City for Science and Technology (KACST) at ummulqura.org.sa. The site is a single-page app. Its converter page (`/converter`, bundle `chunk-CVUPJQHX.js`) calls a public JSON service at `apiBaseUrl = https://umqserv.kacst.gov.sa/api`:

- `GET /v1/DateConversion/GetGregorianFromHijri?yh=&mh=&dh=` returns `{year, month, day, dayWeek, ...}` in Gregorian.
- `GET /v1/DateConversion/GetHijriFromGregorian?yg=&mg=&dg=` returns the same shape in Hijri.

On 2026-11-06 we asked the service for day 1 of every month from 1 Muharram 1440 to 1 Dhu al-Hijjah 1470 (372 months). We then converted each Gregorian date back through `GetHijriFromGregorian`. All 372 round trips came back as day 1 of the same month. The bulk fetch ran from Node with TLS verification turned off, because Node could not build the server's certificate chain. We repeated a sample with `curl` with verification on (1440-01, 1451-01, 1464-06, 1470-10), and the answers were the same.

The fetched table is at `packages/format/test/fixtures/umm-al-qura-month-starts.json`.

Two secondary datasets were compared for context:

- **AsimNet/ummulqura-calendar** (PHP), commit `dd8e8e1a4d67bdf50e84a20981b05f57e240cd37`, `src/Data/MonthStarts.php`. It says its table was scraped from the same KACST service. It matches the service on all 372 months.
- **hijridate** (Python, formerly hijri-converter) 2.6.0, commit `f6f0f4f69da8e58dc65179213822ef7b83a77dcd`, `src/hijridate/ummalqura.py`. It matches the service from 1440 to 1450. From 1451 to 1470 it disagrees on 82 of 240 months, and every time its date is one day earlier than the service's. Its documentation says it took 1412 to 1450 from the printed Umm al-Qura comparison books and 1451 to 1500 from "KACST official website data". The AsimNet README reports the same kind of gap (740 of 1,897 month starts).

The likely origin of the "off by a day around 2030 to 2044" claim is a comparison against hijridate's 1451+ data. 1451 AH begins on 2029-05-14. Measured against the official service, that data is the one that is off, not ICU.

## Method

`packages/format/test/hijri-month-starts.test.ts` loads the fixture. For every month it checks that `toHijri` returns `{year, month, day: 1}` in `Asia/Riyadh` at 00:00:00 and at 23:59:59 local time on the official start date. It also checks that the fixture covers all 372 months. To confirm the test can catch an error, we moved one start date (1464-06) back by a day, and that case failed.

Runtimes: Node v25.6.1 (ICU 78.2) and Node v22.21.1 (ICU 77.1), both on macOS. Both pass.

## Result

372 months checked, 0 mismatches. ICU's `islamic-umalqura` agrees with the official KACST service for every month start from 1440 to 1470 AH, so `hijri.ts` is unchanged. The test stays in place as a guard against a runtime or ICU update that changes the data.

## Limits

- This covers Node's bundled ICU only, in the two versions above. Browsers ship their own ICU or calendar code, and older runtimes may carry older data. The guard runs on whatever Node CI uses (22).
- KACST can revise future months. The fixture is a snapshot from 2026-11-06.
- We used the service behind the official site, not a downloadable table. KACST does not publish a versioned file.
