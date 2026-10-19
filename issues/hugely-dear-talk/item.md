---
created: 2026-10-17
updated: 2026-10-19
type: bug
status: fixed
priority: low
provenance: other
provenance_detail: observed by worker during repo-selection-page
source_ref: taskfleet:01m559aqy945rde2awqtr76453/observed:interrupted-list-process-churn
originating_run: 01m559aqy945rde2awqtr76453
originating_run_kind: spinoff
lane: repo-clone-host
lane_seq: 2
collision: [internal/daemon/github]
preparation: ready
closed: 2026-10-19
---

# Interrupted clone drops out of the clone list while the user's processes churn

## Description

# Interrupted clone drops out of the clone list while the user's processes churn

## Observed

On 2026-10-17, while implementing `repo-selection-page`, the lab browser spec `web/tests/clone-page.spec.ts` failed intermittently: an interrupted clone set up with `/fixture/checkout?name=first&mode=interrupted` was missing from one `GET /api/v1/onboarding/github/clones` reply, so its "Kloonaus keskeytyi" card and the sidebar's "keskeytyi" mark did not appear. Two of three runs failed while the synthetic `git clone` of another repository was held open by a loop that started `sleep 0.1` ten times a second under the same Unix user; with `sleep 1` three of three runs passed. One failure also hit the case with no held clone, while other parallel browser cases (same Unix user in the test host) were running.

## Where

`internal/daemon/github_interrupted_linux.go`, `interruptedClone`: after the Git checks it calls `settledProcessScan` (`internal/daemon/workspace_delete_checks_linux.go`) and treats any `unreadable` process or an incomplete scan as "not interrupted". `settledProcessScan` retries once after 100 ms. A short-lived process of the same UID that is mid-exec or mid-exit can be unreadable in both scans, and the list then simply omits the directory with `interrupted_complete: true`.

## Impact

The interrupted clone's card and sidebar mark disappear for one read and come back on a later one. The person may miss the only place where "Aloita alusta" / "Poista keskeneräinen" are offered, or see the entry flicker. Any user with an active build or agent spawning short processes is exposed. Deletion safety is not affected: `restart` and `remove` keep their own checks.

## Direction

For the read-only list, an unreadable-but-transient process could be retried a few more times, or the entry reported with an "unconfirmed" flag (or `interrupted_complete: false`) instead of silently omitted, so the browser keeps showing it. The checks before `restart`/`remove` should stay strict.

## Acceptance Criteria

- [x] An inconclusive process scan retains the interrupted candidate in the read-only list and reports incomplete observation.
- [x] Deterministic regression fails with strict-list omission restored; strict restart/remove recognition remains unchanged.
- [x] Daemon/caller race tests, contracts, fast web checks, and five clone-page runs under same-UID process churn pass.
