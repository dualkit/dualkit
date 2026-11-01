# Dualkit proof scoreboard

Measured 2026-11-01. Convert ran on 10 real open-source apps, each pinned to one commit.

- Apps converted without error: 10 of 10
- Strings moved into translation files: 5573
- English strings left behind: 1788
- String coverage: 76%
- New type errors after converting: 76

This run covers phase 1 and a TypeScript check before and after. It does not yet measure a production build or whether `--finish` passes.
The left-behind count comes from a separate scanner, and it is a floor because that scanner cannot see strings built at run time.

| App | Framework | Outcome | Strings | Left behind | Coverage | Flags | New type errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [tailadmin-next](https://github.com/TailAdmin/free-nextjs-admin-dashboard/tree/1ef305c5b1332c899c5ffdeb72b56235d42d6d00) | next | converted | 483 | 94 | 84% | 84 | 0 |
| [kiranism-dashboard](https://github.com/Kiranism/next-shadcn-dashboard-starter/tree/00ed72e63179c1aadcbca6eb7423a8aa91d95741) | next | converted | 468 | 146 | 76% | 96 | 0 |
| [taxonomy](https://github.com/shadcn-ui/taxonomy/tree/298a8857c7128a0d121e7f699dfd729f23b3966d) | next | converted | 123 | 39 | 76% | 25 | 76 |
| [next-admin](https://github.com/arhamkhnz/next-shadcn-admin-dashboard/tree/02a1208f112e879f4cedc3ccb73ef7ff1aa9d437) | next | converted | 1169 | 367 | 76% | 228 | 0 |
| [saas-stripe](https://github.com/mickasmt/next-saas-stripe-starter/tree/c6df229ae73c207e87356d5e592779c511a9b56d) | next | converted | 358 | 141 | 72% | 74 | 0 |
| [saas-starter](https://github.com/nextjs/saas-starter/tree/6e33e58b1e553a41fe22e6b941a7229a002de361) | next | converted | 86 | 10 | 90% | 9 | 0 |
| [shadcnstore-next](https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/866423741fa4b62d5e9427603cb2174aedf00f80) | next | converted | 980 | 412 | 70% | 136 | 0 |
| [shadcn-admin](https://github.com/satnaing/shadcn-admin/tree/e16c87f213a5ba5e45964e9b67c792105ec74d26) | vite | converted | 455 | 127 | 78% | 74 | 0 |
| [tailadmin-react](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard/tree/df1e9f37e56e0bf83030e8063f5353da2e0ecf18) | vite | converted | 460 | 50 | 90% | 60 | 0 |
| [shadcnstore-vite](https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/866423741fa4b62d5e9427603cb2174aedf00f80) | vite | converted | 991 | 402 | 71% | 135 | 0 |
