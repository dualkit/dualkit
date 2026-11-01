# Dualkit proof scoreboard

Measured 2026-11-01. Convert ran on 10 real open-source apps, each pinned to one commit.

- Apps converted without error: 8 of 10
- Strings moved into translation files: 5600
- English strings left behind: 1043
- String coverage: 84%
- New type errors after converting: 76
- Apps that still build after converting: 6 of 6 that built before
- Apps that pass `--finish`: 3 of 8

This run covers phase 1, a TypeScript check, a production build before and after, and `--finish` on stand-in Arabic. Stand-in Arabic proves the layout and the wiring, not the translation.
The left-behind count comes from a separate scanner, and it is a floor because that scanner cannot see strings built at run time.

| App | Framework | Outcome | Strings | Left behind | Coverage | Flags | New type errors | Builds after | Passes finish |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [tailadmin-next](https://github.com/TailAdmin/free-nextjs-admin-dashboard/tree/1ef305c5b1332c899c5ffdeb72b56235d42d6d00) | next | refused | 0 | 0 | - | 0 | - | - | - |
| [kiranism-dashboard](https://github.com/Kiranism/next-shadcn-dashboard-starter/tree/00ed72e63179c1aadcbca6eb7423a8aa91d95741) | next | converted | 636 | 85 | 88% | 82 | 0 | yes | no |
| [taxonomy](https://github.com/shadcn-ui/taxonomy/tree/298a8857c7128a0d121e7f699dfd729f23b3966d) | next | converted | 132 | 39 | 77% | 26 | 76 | not buildable before | yes |
| [next-admin](https://github.com/arhamkhnz/next-shadcn-admin-dashboard/tree/02a1208f112e879f4cedc3ccb73ef7ff1aa9d437) | next | converted | 1423 | 233 | 86% | 187 | 0 | yes | no |
| [saas-stripe](https://github.com/mickasmt/next-saas-stripe-starter/tree/c6df229ae73c207e87356d5e592779c511a9b56d) | next | converted | 455 | 95 | 83% | 65 | 0 | yes | no |
| [saas-starter](https://github.com/nextjs/saas-starter/tree/6e33e58b1e553a41fe22e6b941a7229a002de361) | next | converted | 86 | 10 | 90% | 10 | 0 | not buildable before | no |
| [shadcnstore-next](https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/866423741fa4b62d5e9427603cb2174aedf00f80) | next | converted | 1175 | 244 | 83% | 117 | 0 | yes | - |
| [shadcn-admin](https://github.com/satnaing/shadcn-admin/tree/e16c87f213a5ba5e45964e9b67c792105ec74d26) | vite | converted | 507 | 103 | 83% | 72 | 0 | yes | yes |
| [tailadmin-react](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard/tree/df1e9f37e56e0bf83030e8063f5353da2e0ecf18) | vite | refused | 0 | 0 | - | 0 | - | - | - |
| [shadcnstore-vite](https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/866423741fa4b62d5e9427603cb2174aedf00f80) | vite | converted | 1186 | 234 | 84% | 116 | 0 | yes | yes |
