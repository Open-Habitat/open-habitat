---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
lane: web-routes
lane_seq: 1
collision: [web/src/app/settingsRoute]
---

# All URL paths in English (settings sections and deep links)

## Description

Jari 2026-10-23: `https://open-habitat-test.example.test/settings/integraatiot` mixes languages. All URL paths are English (e.g. `/settings/integrations`, `/settings/storage`, `/settings/server`), while the UI text stays Finnish. `web/src/app/settingsRoute.ts` maps sections to Finnish slugs (`integraatiot`, `tallennustila`, `palvelin`, …), and several call sites hard-code them (`StoragePressure.tsx`, `App.tsx`, `WorkspaceTrash.tsx`). Check every route the browser uses, including query parameters and any server-side links or redirects the gateway/daemon emit (OAuth return paths, notification links, deep links in agent notices). No compatibility redirects are needed (pre-release), but in-product links must all move.

## Acceptance Criteria

- [ ] No Finnish words in any URL path or query key the product generates; one source of truth for settings slugs, no hard-coded copies.
- [ ] Browser tests updated; a test fails if a non-ASCII-English slug is introduced.
