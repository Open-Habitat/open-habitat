---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: open
priority: normal
lane: worktree-list-proto
lane_seq: 1
preparation: pending
---

# Design and prototype: a workspace's worktree list a person can understand and act on

## Description

Jari 8.11.2026, test server, the Open Habitat workspace's front page,
*Worktreet* section (screenshot `evidence/`): he had one conversation running
and the rest archived, yet the list is full of rows like
`wt-d0qmfx5v37-testaaja`, `wt-hw4ctnr0kf-testi-avustaja`,
`wt-vwek5m102j-testi-interaktiivinen-odottaa`, each with a path, a branch,
445 MiB, *yhdistetty*/*ei yhdistetty* and "Taskfleet-ajo … omistaa tämän
worktreen". He cannot tell what any of them are, nothing appears to be
running, and almost every button is disabled (only one row has *Poista…*;
*Siivoa kaikki yhdistetyt…* is disabled too) with no way to react.

Cause in short: helpers (resident runs) keep their worktree between rounds,
also when their conversation is archived, and an interactive test run waits
for an explicit merge or cancel; Habitat correctly refuses to remove a
worktree a live run owns, but says so in Git and Taskfleet terms and offers
no route.

Prototype round per `AGENTS-WORKFLOW.md`: how this section should read and
what a person can do. Questions to explore: name each row by what it is for
a person (the helper's name and its conversation, archived or not; a
worker's task; a leftover) instead of the directory; show only what needs
attention by default; for a row a live run owns, say what keeps it and lead
to where it is handled (its conversation, where the main agent ends or lands
it — Habitat itself stops nothing, Jari 6.11.; or the browser's archive
flow); what *Siivoa* does when some merged rows are owned. Three
directions, 1440 and 390, light and dark. Also note in result.md whether an
archived conversation's idle helpers should release their worktree (Taskfleet
idle expiry) and recommend.

## Acceptance Criteria

- [x] Prototype round 1 with view offer, directions and questions for Jari.
