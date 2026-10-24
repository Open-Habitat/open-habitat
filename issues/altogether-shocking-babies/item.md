---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5pfjq0ssjxhqjrrkwcbqas8/gate:402379a3-title-dots
originating_run: 01m5pfjq0ssjxhqjrrkwcbqas8
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# browser-conversation title-dots case fails the gate when a snapshot route is in flight at test end

## Description

`tests/browser-conversation.spec.ts:3118` ("@browser-conversation title dots follow automatic observations and manual replies") failed once in the full clean gate on 2026-10-24 (branch commit 402379a3, run 01m5pfjq0ssjxhqjrrkwcbqas8, load average ≈10) with:

    Error: "route.fetch: Test ended. … GET /api/v1/snapshot" while running route callback.
    Consider awaiting `await page.unrouteAll({ behavior: 'ignoreErrors' })` before the end of the test

The `page.route("**/api/v1/snapshot", …)` handler at line 3126 awaits `route.fetch()`; a snapshot poll still in flight when the test finishes makes the test fail. The same spec passed alone on that commit and on main 5ff1f9da. It is the in-flight-route lifecycle race that `phenomenally-various-jail` fixed elsewhere; this case still has it. Likely fix: `await page.unrouteAll({ behavior: "ignoreErrors" })` (or wait for the handler to settle) before the test ends.

## Acceptance Criteria

- [x] Remove the reported response/route lifecycle race without dropping behavior assertions.
- [x] Run the affected complete spec ten times with retries disabled.
