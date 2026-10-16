---
created: 2026-10-16
updated: 2026-10-16
type: improvement
reporter: jari
status: open
priority: high
lane: performance
collision: [internal/daemon]
preparation: ready
---

# Make the snapshot cheap: under 100 ms on the test server

Step 0 of `issues/ui-responsiveness-review/analysis.md`, accepted by Jari 2026-10-16. Every click and page load waits for `GET /api/v1/snapshot`, which rebuilds the whole state from scratch: about 30 child processes including `gh api user` over the network, 1.1–1.3 s live, 2.4 s when two overlap (`internal/daemon/snapshot_linux.go`). Keep the GitHub identity until `gh`'s credential files change, recompute git facts per workspace only when their inputs change, run independent parts concurrently, and stop Pi file writes from triggering several full snapshots a second during a turn. No contract change. Derived facts kept in memory are invalidated by their native inputs; no persisted cache.

## Acceptance Criteria
- [ ] Snapshot under 100 ms warm on the test server (measured as in the analysis, live after release), and correct after git, gh and workspace changes (tests).
