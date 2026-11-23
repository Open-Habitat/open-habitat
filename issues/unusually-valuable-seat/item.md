---
created: 2026-11-23
updated: 2026-11-24
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

## Comments

### 2026-11-23T23:07:06Z · @release-driver

More clean-gate load flakes at `e4a4e3bdd` (24.11.2026, same 8-core arm64 host, separate clone, nothing else running tests; scratch on a short path with plenty of free space):

- Gate 5: ordinary `browser-conversation.spec.ts:2335` (stopped restored turn) and `recap-resting.spec.ts:178`. Each passed 3/3 alone.
- Gate 6: ordinary `attachment-documents.spec.ts:39` (document preview not visible within 5 s; also flaked in an earlier gate). Passed 3/3 alone.
- Gate 7: ordinary `pi-onboarding-race.spec.ts:6` (test timeout in the `finally` fixture reset at line 129), lab `lab-worktree-agent.spec.ts:26` (intro centred 30 px off the composer at line 85, expected < 2), and again `scripts/test-gate-storage.py` `test_successful_shell_cleans_before_recording_receipt` (exit 141, SIGPIPE). Each passed 3/3 alone.
- Gate 8: died in its dependency phase on an npm registry `ETIMEDOUT` before any check ran (network, not a test); rerun at once.
- Gate 8 rerun: ordinary `github-stream.spec.ts:34` (second clone not `confirmed` within the 5 s poll at line 90); Go/contracts, packaging and lab 344/344 green, ordinary 762/763. Passed 3/3 alone.

Every gate round has had one to three different specs fail under the whole suite's own load, while each passes alone. Every gate takes about 25 minutes here, so a release needs several rounds before one comes out green by chance.
