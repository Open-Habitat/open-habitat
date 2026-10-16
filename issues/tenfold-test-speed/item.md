---
created: 2026-10-13
updated: 2026-10-16
type: improvement
reporter: jari
status: wontfix
priority: high
related: ['@fast-focused-tests']
lane: release-tooling
preparation: ready
closed: 2026-10-16
---

# Reach an order-of-magnitude faster gate with test-scale limits and a redundancy audit

Follow-up to `fast-focused-tests` (Jari, 2026-10-13: an order-of-magnitude
speedup on both the browser and the Go side, and an honest check that the
tests are the right ones). That run made the two phases concurrent and added
focused scopes, but a changed-tree gate still takes about 170 s warm (browser
129 s, Go/contracts 124 s) and no test was audited for redundancy. Its
measurements are in `issues/fast-focused-tests/result.md` and `profile.md`.

## What the measurements point at

- **Go:** the daemon package is 65 of 66 s of `go test -race`; one case,
  `TestTailPageLargeNativeFileAndByteCap`, takes 34 s, and two others about
  7 s each. They prove paging and byte-cap bounds by feeding real-size inputs.
  The same logic can be proved with test-scale limits (the cap and page sizes
  injected, inputs a few times the cap) so that the bounds are still crossed;
  only a separate, explicitly slow check, if any, needs production-size input.
  Also measure what `-race` costs per package and whether it is needed on
  every package in every gate run, or only on the packages that run
  concurrent code.
- **Browser:** compile, host start-up (17 ms median) and Chromium launch are
  small. Time goes into journeys that wait on real lease and polling deadlines
  (Pi onboarding 21 s; the 58-case `browser-conversation.spec.ts` is
  241 case-seconds). The synthetic host can run those deadlines at test scale
  (injected durations or the synthetic clock) so the same state transitions
  happen in milliseconds; what is proved stays the same.
- **Redundancy:** not done yet. For each browser spec, list what it asserts
  and which other spec, component test or Go test already proves the same
  thing. Keep a browser case when it is the only proof of a cross-layer
  behaviour; move a pure rendering or client-state assertion down to Vitest.

## Acceptance Criteria

- [ ] A changed-tree warm clean gate runs in a small fraction of today's 170 s; `result.md` records before and after per phase and explains any part that could not be cut.
- [x] `result.md` has the redundancy audit: every removed, merged or moved test with the test that now carries its proof. Security-boundary tests stay unless an equivalent test provably covers them.
- [x] Test-scale limits and durations come from the test harness only; production defaults are unchanged and covered by a test.
- [x] The full clean gate passes and `release_test.py` accepts its receipt unchanged.

## Resolution

### 2026-10-16T03:12:34Z · @issuectl

Closing the remaining order-of-magnitude target at Jari’s request. The redundancy audit, test-scale limits and clean gate receipt were delivered; the unchecked small-fraction (<60 s) target was not. On the final unchanged tree, two passing no-reuse clean gates took 203 s in the default parallel mode and 224 s in optional serial mode; neither is a comparable passing before/after speedup against the original tree. Further deletion of the expensive Pi, uncertain-write, identity/UID and recovery journeys would discard distinct fault evidence, so we are not scheduling more test-pruning work under this issue. The evidence and limits are in result.md, quality-audit.md and phase-schedule.md.
