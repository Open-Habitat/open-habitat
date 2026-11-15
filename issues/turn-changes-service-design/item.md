---
created: 2026-11-15
updated: 2026-11-15
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/turn-changes-service
lane: turn-changes-service
lane_seq: 1
preparation: ready
---

# Design: one shared turn-changes service for turn summaries, rewind and the upstream extension

## Description

Jari 15.11.2026: the "Vuoron muutokset" feature (`turn-changes-summary`, what the agent changed in a turn) suffers from the same problem as the rewind extension (`rewind-tracks-all-changes`): it sees only edit/write tool changes, not shell or script edits. Idea: one shared turn-changes capability — a plugin/service that captures each turn's file changes (e.g. the working-tree snapshots recommended in `rewind-tracks-all-changes/design.md`) and offers them as a service, which Habitat's Vuoron muutokset, Palaa tähän and the upstream better-pi-rewind extension could all use. Or something along those lines.
