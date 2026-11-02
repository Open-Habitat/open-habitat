---
created: 2026-11-02
updated: 2026-11-02
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed by the gate-in-minutes worker while measuring whole-suite runs
source_ref: taskfleet:01m6dgsvnh70e798a9gh44sq4n/observation:load-only-browser-flakes
originating_run: 01m6dgsvnh70e798a9gh44sq4n
originating_run_kind: spinoff
---

# Browser cases that fail only under host load make the clean gate red without a defect

## Description

Browser cases that fail only when Birch is loaded, observed while measuring the
clean gate on 2.11.2026 (gate-in-minutes). Each passes repeatedly in isolation
on the same tree (8–24 repeats), and each failed in at least one whole-suite run
with load average 15–38 (other workers' runs beside the gate's own):

- `lab-conversation-scroll.spec.ts:201` "the first turn is followed before its
  history is read": `turn.length > 30` saw 24 and 12 frames (135 idle). Also
  fails on main under load (baseline run, commit de44e75a). Counting frames
  measures the host's load, not the follow; a span check is not enough either,
  since under saturation the sampler saw only 0.4 s of the 11 s turn.
- `lab-conversation.spec.ts:517` "real controller creates and persists a
  fake-Pi turn": the conversation-menu click timed out (30 s test budget).
- `live-long-run.spec.ts:12`: working span 70 ms < 7000 (see the open
  live-long-run-gap-under-load).
- `settings-search.spec.ts:70`: Enter landed on `#recap-model` where the second
  result read a moment earlier was `default-model`; the result order seems to
  change after the list first settles.
- `account-settings.spec.ts:704` (credential row not visible within 5 s) and
  `:301` (focus timed out at 30 s).
- `rail-archive.spec.ts:6`: the archived row did not come back within 25 s.
- `workspace-slice.spec.ts:310` @a11y: 30 s test timeout (baseline on main).

Impact: the clean gate is red without a product defect whenever another
whole-suite or heavy run shares the host, so its failures must be re-run by
hand to tell a regression from load. Fixed in the same work (real test races,
not load): github-connection-warning re-routing and aborted navigation,
pi-onboarding-race click after the step advanced, browser-conversation cold
open status read.
