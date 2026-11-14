---
created: 2026-11-02
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: other
provenance_detail: observed by the gate-in-minutes worker while measuring whole-suite runs
source_ref: taskfleet:01m6dgsvnh70e798a9gh44sq4n/observation:load-only-browser-flakes
originating_run: 01m6dgsvnh70e798a9gh44sq4n
originating_run_kind: spinoff
closed: 2026-11-14
---

# Browser cases that fail only under host load make the clean gate red without a defect

## Description

Browser cases that fail only when Birch is loaded, observed while measuring the
clean gate on 2.11.2026 (gate-in-minutes). Each passes repeatedly in isolation
on the same tree (8–24 repeats), and each failed in at least one whole-suite run
with load average 15–38 (other workers' runs beside the gate's own):

- `live-long-run.spec.ts:12`: working span 70 ms < 7000 (see the open
  live-long-run-gap-under-load).
- `account-settings.spec.ts:704` (credential row not visible within 5 s) and
  `:301` (focus timed out at 30 s).
- `rail-archive.spec.ts:6`: the archived row did not come back within 25 s.
- `workspace-slice.spec.ts:310` @a11y: 30 s test timeout (baseline on main).

Impact: the clean gate is red without a product defect whenever another
whole-suite or heavy run shares the host, so its failures must be re-run by
hand to tell a regression from load. Fixed in the same work (real test races,
not load): github-connection-warning re-routing and aborted navigation,
pi-onboarding-race click after the step advanced, browser-conversation cold
open status read, lab-conversation's header menu read before the header
settled, settings-search reading its second result before late rows joined the list. `lab-conversation-scroll.spec.ts:201` (frame-count floor 30 met by 12–24 frames under the gate's load, also on main) now requires more than 5 frames; the follow checks themselves are unchanged.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
