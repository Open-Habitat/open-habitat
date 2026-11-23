---
created: 2026-11-23
updated: 2026-11-23
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m84ybwhn4y53av81q1z8cwq4/observation:gate-load-flakes-v017
originating_run: 01m84ybwhn4y53av81q1z8cwq4
originating_run_kind: spinoff
---

# Clean gate flakes under its own load (gate-storage SIGPIPE, design-system, lab scroll)

## Description

## Observed

On 23.11.2026 the v0.1.7 release driver ran `scripts/ci-local.sh --clean --json` three times on an 8-core arm64 development host (separate `git clone --no-local`). Each run went red on checks that pass in focused reruns on a calm host:

- `scripts/test-gate-storage.py` `test_successful_shell_cleans_before_recording_receipt`: `AssertionError: 141 != 0 : synthetic host diagnostic` (SIGPIPE) in gate 1 (`b35353874`) and gate 3 (`e4a4e3bdd`). Passes 3/3 when run alone.
- `web/tests/design-system.spec.ts:90` (reduced motion) and `:103` (axe light/dark/unhappy) failed in gates 1 and 3. Passes in focused reruns.
- `web/tests/lab-conversation-scroll.spec.ts:419` (phone short touch scroll) failed in gates 1 and 3. `lab-reply-selection.spec.ts:44` failed in gate 2 and passed 3/3 focused.
- Packaging block: gate 2 exited 1 silently after the socket regression. The same block passed 3/3 standalone.

Load during the browser phase reached 13–22 (in gate 1 partly from another worker's tests; gates 2–3 had the host to themselves).

## Impact

No clean-gate receipt could be produced for v0.1.7 tonight. Each gate round takes about 15 minutes.

## Evidence

Failure logs stay in each clone's `.git/open-habitat-gate-failure/` on the release host (not kept forever).
