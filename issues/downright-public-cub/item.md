---
created: 2026-10-18
updated: 2026-10-19
type: bug
status: open
priority: normal
provenance: other
lane: gate-health
lane_seq: 1
collision: [internal/daemon/]
preparation: ready
---

# Gate flake: history watcher test fails when inotify instances run out

## Description

The clean gate on main `84ce03ea` (2026-10-18) failed only in `internal/daemon`: `TestExternalPiAppendReachesTwoStreamsAndNativeHistory` — `history_watch_linux_test.go:42: watcher could not start`. Alone it passes 3/3. Alder's `fs.inotify.max_user_instances` is 128, with 87 inotify instances in use by other processes (worker Vite servers, editors) while idle; the gate's parallel browser hosts plus the Go suite likely exhaust it. The test treats a watcher start failure as a test failure. Either make the test skip or retry with a clear reason when the host has no inotify instances left (the product already degrades when the watcher cannot start, per edffc731), or have the gate report the inotify headroom; raising the host limit is a Fleetrepo/Alder change, not a product one.

## Second occurrence (2026-10-18, rerun of the same tree `84ce03ea`)

The rerun passed the earlier test and failed a different one in the same package: `TestHeldMessagesSurviveFailedStart` — `held_linux_test.go:352: timed out: retried prompt accepted` after 15.1 s. Alone it passes 3/3 in 0.25 s. So the `internal/daemon` suite is load-sensitive in the gate's parallel phase (browser hosts and Go concurrently), not one inotify test: find the shared cause (CPU/inotify/fd pressure, fixed timeouts) before fixing single tests.

## Acceptance Criteria

- [x] Explain the shared-load failure modes with resource and controlled scheduling evidence.
- [x] Fix the failure modes without hiding product failures; repeat the daemon suite five times with pressure and without deliberate pressure.
- [ ] Review product changes and run the clean gate once on committed work; record any unrelated gate failure.
