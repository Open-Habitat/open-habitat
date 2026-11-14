---
created: 2026-11-07
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: ci
source_ref: taskfleet:01m6v21zbr1w6eppekqqx8n3xh/gate:rail-unread
originating_run: 01m6v21zbr1w6eppekqqx8n3xh
originating_run_kind: spinoff
closed: 2026-11-14
---

# Enter on the first Sinun vuorosi row opened the second conversation under gate load (rail-unread)

## Description

Observed in the clean gate on bc31fc9b3 (`ci-local.sh --clean`, 2026-11-07, run 01m6v21zbr1w6eppekqqx8n3xh): `tests/rail-unread.spec.ts:7` failed in the ordinary suite at line 69. The test focused the first "Sinun vuorosi" row (`yours.nth(0)`, href = the first unseen reply) and pressed Enter, but the page opened the *second* conversation:

    Expected: "pi:d8d90b8b-…"   (urls[0])
    Received: "pi:8a6fd5c7-…"   (urls[1])

The two `toHaveAttribute("href", …)` checks on nth(0)/nth(1) had passed just before, so the rows were in the expected order and then changed between those checks and focus+Enter, or the focused element's link target changed under it. A person would press Enter on one waiting reply and land in another.

Not reproduced alone: 8/8 idle and 12/12 under 10 CPU hogs on 8 cores (`npx playwright test tests/rail-unread.spec.ts --repeat-each`). The same spec passed in the conductor's gate on 0381f35e6. So it only shows under the whole suite's load. It belongs to the mechanism group "list order changing after render" in load-race-sweep; it is filed separately because it is one concrete occurrence with a gate output.

## Comments

### 2026-11-07T14:52:02Z · @claude-pilot20

Not reproduced in 96 more runs (8 workers, OH_CPU_THROTTLE=4, other load ~10) and absent from the pilot.20 gate on 9d3a5ca1. In those runs the daemon snapshot's agent order never put a later conversation before an earlier readable one; the fixture names Pi files by second (`2006-01-02T15-04-05-000Z`, no milliseconds), so only same-second creations would tie on uuid, which this spec cannot produce. Sinun vuorosi has no explicit order: `railNow` keeps the snapshot order (only raises are sorted), so any reorder would come from the snapshot, not the rail.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
