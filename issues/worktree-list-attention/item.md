---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: worktree-list-proto
lane_seq: 2
preparation: ready
---

# Implement the worktree list's Huomio direction

## Description

Jari accepted direction **1 Huomio** of `proto-worktree-list-meaning` round 1
on 8.11.2026; the round (`design-system/prototypes/rounds/2026-11-08-worktree-lista/`)
and the issue's `result.md` (host facts, decisions) are the specification.
By default the workspace's worktree section shows only rows the person can
act on, each named by what it is for them (helper and its conversation,
worker task, leftover) with its one right action; self-releasing helpers and
working workers are summarised on one line with the time a helper's worktree
releases itself (Taskfleet's 24 h idle expiry). *Siivoa* removes only merged
rows as today. No new host command: the owner comes from the daemon's
existing Taskfleet run read. Ships directly (it replaces a confusing view
Jari reported; not a new feature behind a flag).

## Acceptance Criteria

- [ ] The section matches direction 1 for Jari's rows and the prototype's cases, fi and en, 1440 and 390, light and dark.
- [ ] Explain-mode cards for its rows and actions; touched specs green; KOKEILTAVAA line.
