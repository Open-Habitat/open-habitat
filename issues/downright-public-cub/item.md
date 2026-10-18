---
created: 2026-10-18
updated: 2026-10-18
type: bug
status: untriaged
priority: normal
provenance: other
---

# Gate flake: history watcher test fails when inotify instances run out

## Description

The clean gate on main `84ce03ea` (2026-10-18) failed only in `internal/daemon`: `TestExternalPiAppendReachesTwoStreamsAndNativeHistory` — `history_watch_linux_test.go:42: watcher could not start`. Alone it passes 3/3. Alder's `fs.inotify.max_user_instances` is 128, with 87 inotify instances in use by other processes (worker Vite servers, editors) while idle; the gate's parallel browser hosts plus the Go suite likely exhaust it. The test treats a watcher start failure as a test failure. Either make the test skip or retry with a clear reason when the host has no inotify instances left (the product already degrades when the watcher cannot start, per edffc731), or have the gate report the inotify headroom; raising the host limit is a Fleetrepo/Alder change, not a product one.
