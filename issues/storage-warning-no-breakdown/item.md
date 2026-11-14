---
created: 2026-11-13
updated: 2026-11-14
type: improvement
status: open
priority: normal
provenance: chat
source_ref: conductor:2026-11-13/storage-warning
lane: storage-proto
lane_seq: 1
preparation: pending
---

# The storage warning leads nowhere: no cache breakdown and no way to ask the agent to clean up

## Description

## Observed

The storage warning (from 85 %) tells the person to empty the Trash or ask
the agent to clean caches and old worktrees, but the Storage view groups
everything into one row, "Workspaces, agent history and caches". On one
installation 121 GiB of a person's usage held about 34 GiB of regenerable
caches (Go build cache 24 GiB, an old Rust target 9 GiB, npm 3 GiB) and
27 GiB of Rust targets of running worker runs. None of that is visible, and
the view offers no way to ask the agent to clean up. Cleaned by hand
(121 → 87 GiB).

The Go build cache also grows in the home directory (`~/.cache/go-build`),
although build scratch belongs to a disposable scratch location.

## Questions

- A breakdown of known caches (Go, npm, Cargo targets, Playwright, ...) and
  worktrees' build directories in the Storage view.
- A button that opens a conversation with a ready clean-up request.
- Where the Go build cache should live for agent and worker builds.

Reported by Jari 13.11.2026.
