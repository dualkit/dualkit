# Middleware smoke run, 1 November 2026

Convert now composes next-intl with an app's own middleware. Unit tests only read the generated text, so we built a small Next 15.5 app with a real login middleware (`matcher: ['/dashboard/:path*', '/api/secret']`), converted it, ran `next build` and `next start`, and probed it over HTTP.

The first attempt did not compile, and the app's own response headers were dropped. Both are fixed.

| Request | Logged out | Logged in |
| --- | --- | --- |
| `/dashboard` | 307 to `/login` | 200 |
| `/ar/dashboard` | 307 to `/login` | 200 |
| `/en/dashboard` | 307 to `/login` | not run |
| `/ar/dashboard/x` | 307 to `/login` | not run |
| `/api/secret` | 401 | 200 |
| `/ar/api/secret` | 401 | 404, as there is no Arabic API route |

The app's custom response header arrived on logged-in pages.

Not tested: Clerk and other auth libraries, which need real keys, and the three other apps in the proof suite that have middleware.

Found on the way: every page's HTML carries the whole messages file, so a logged-out visitor can read the copy of protected pages. The data stays protected, but the words do not. This needs per-route messages.
