---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/worktree-containers-shown-as-workspaces
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# Empty __worktrees containers appear as workspaces

## Description

Jari 15.11.2026 (test server): after the last worktree was removed from the
Storage page, the sidebar showed a workspace "open-habitat-archive__work…"
(icon OW). `open-habitat agent workspace list` lists every `~/src/*__worktrees`
container as an ordinary visible workspace (`kind: directory`,
`hidden: false`), all empty. These containers are Taskfleet's/workmux's
(`internal/daemon/worktree_places_linux.go` knows `Name + "__worktrees"`),
not the person's workspaces, so the workspace list must leave them out even
when empty. The parent repository was hidden but its container was not. The
same container also appeared on the home page's "Ei avointa työtä" list
("Git-tila ei tiedossa"), while other empty containers appeared in neither
place although the daemon lists them as visible — find why they differ.

## Acceptance Criteria

- [x] Empty and occupied conventional worktree containers are absent from shared workspace discovery, including CLI and icon consumers.
- [x] Git-recognized nonstandard containers remain excluded; ordinary mixed-use directories remain available.
- [x] Last-checkout removal and browser home/sidebar regressions are covered, and the inconsistent filtering is explained in `result.md`.
