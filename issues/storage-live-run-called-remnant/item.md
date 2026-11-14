---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/storage-live-run-called-remnant
lane: unlaned
lane_seq: 1
preparation: ready
---

# Storage page calls a live Taskfleet run's worktree a remnant and offers delete

## Description

Jari 14.11.2026 (test server): Settings › Storage › Worktrees listed a row
"Jäänne · <run title>" (445 MiB, "ei yhdistetty", one commit not on main) and
offered "Poista…". It was a live `--interactive` Taskfleet spinoff (status
pending, supervisor alive). The page's own text says a running run's worktree
is not removed, yet the row is called a remnant and delete is enabled. The
dialog lists four processes by PID and tells the person to close them or
leave the directory, which cannot be done from the browser, and the delete
button is still active. Jari: "en ymmärrä miksi siinä näkyy tollainen
worktree tai miksi se on ja miksi sitä ei lopulta voi poistaa". After
`taskfleet run cancel` the worktree stayed on disk.

Expected: the row recognises a Taskfleet run and says so in human terms (for
example "Worker odottaa päätöstäsi"), offers no delete for a live run, and
points to the parent agent (or offers cancel through the agent). A cancelled
run's leftover worktree is shown as such, with an honest action.
