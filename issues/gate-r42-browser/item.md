---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: conductor gate run on main 687dd83c
source_ref: taskfleet:01m68aa7x7v3s7fsysdq646zf8/gate-r42-browser
originating_run: 01m68aa7x7v3s7fsysdq646zf8
originating_run_kind: spinoff
closed: 2026-10-31
---

# Gate r42 browser: ModelField routes Proxy throws under React Refresh; start-here 390 contrast read mid-fade

## Description

The clean gate on main 687dd83c failed in the browser phase on two items.

1. Vite's dev server logged `[Unhandled error] TypeError: marks[provider] is not iterable`
   on every app load. `routes` in `web/src/components/ModelField.tsx` was a Proxy that
   resolved any key via `marks[provider]`. React Refresh's `registerExportsForReactRefresh`
   reads `routes.constructor` (in `isPlainObject`) for every export of a component module.
   `marks.constructor` is `Object`, so the spread threw. This only happens on the dev server;
   the production build has no Refresh runtime.
2. `tests/start-here.spec.ts` `@lab @a11y authored start page and safe draft 390 light`
   failed axe color-contrast on `.ah-start-heading`: #71767c on #f6f7f8.
   That colour is `--ah-ink-2` (#3d434b) at about 72 % opacity over `--ah-bg`.
   Settled, the heading paints #3d434b (about 9.6:1), with nothing over it.
   So axe read the page mid-fade under gate load; the token is fine.
