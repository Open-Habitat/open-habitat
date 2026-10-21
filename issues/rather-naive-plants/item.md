---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m5e8vxwacyv7zek57natgew3/observed:interrupted-clone-list-transient-negative
originating_run: 01m5e8vxwacyv7zek57natgew3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Interrupted clone disappears from a confirmed list after unrelated removal

## Description

## Description

The interrupted-clone list can remove a still-present clone from its response after an unrelated clone is removed, leaving no restart action. Observed once in the post-review focused `clone-page.spec.ts` run on the warm Cedar runner on 2026-10-21; the same case passed in the second full suite and an earlier focused run. This is a second isolated residual of @browser-suite-red.

The host-backed test at `web/tests/clone-page.spec.ts:193` creates interrupted `fixture/first` and `fixture/second`, removes second, returns to the clone page, then tries first's "Aloita alusta" action. The click at line 219 timed out because first's entire card had disappeared.

Trace network evidence (successive GET `/api/v1/onboarding/github/clones` replies):

1. `interrupted: [fixture/first, fixture/second]`, `interrupted_complete: true`.
2. After removing second: `interrupted: [fixture/first]`, `interrupted_complete: true`.
3. 143 ms later, with no intervening restart/remove write for first: `interrupted: []`, `interrupted_complete: true`.

The final page was `/workspaces/new` with the normal catalog, no clone cards. The filesystem was not directly inspected before host teardown, so permanent filesystem loss is not established.

Named cause: transient negative interrupted-clone discovery is treated as a confirmed empty list and the client has no follow-up re-probe. `internal/daemon/github_jobs_linux.go` list's `observe` callback intentionally keeps unknown candidates but still passes known `inside` processes to `interruptedCloneWithScan` (`github_interrupted_linux.go`). Concurrent snapshot/Git inspectors can briefly be inside the candidate directory; the list reports complete and the client `CloneJobs.read` replaces the interrupted entries. Verify which native gate produced the transient negative (the trace alone cannot identify the exact PID). Do not make destructive writes less strict merely to keep read-only candidates visible.

## Reproduction

Run `cd web && npx playwright test clone-page.spec.ts --trace on` on the warm runner; the interrupted removal/restart journey intermittently fails after the removal navigation triggers concurrent clone and workspace refreshes. It passed under the full suite and failed in a subsequent focused run.

Self-contained evidence above is supplemented on Alder by `/var/tmp/browser-red-reviewed-browser.log`, `/var/tmp/browser-red-clone-inspect.txt` and `/var/tmp/browser-red-clone-results/test-results/clone-page--lab-an-interru-c5210--or-removed-only-explicitly-chromium/trace.zip`.

## Acceptance Criteria

- [ ] Removing second does not permanently hide first's restart action because of transient native inspection.
- [ ] The existing interrupted-clone removal/restart browser journey passes without sleeps, weakened assertions or relaxed write eligibility.
