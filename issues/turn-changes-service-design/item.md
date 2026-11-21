---
created: 2026-11-15
updated: 2026-11-21
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

## Decisions

### 2026-11-15T19:15:41Z · @jari

Jari 15.11.2026: recommended direction (recorder inside better-pi-rewind) noted; Jari asks the upstream maintainer first. Nothing is built until his opinion is known.

### 2026-11-21T07:47:51Z · @jari

Jari 21.11.2026: Raine is responsive when the work is done properly — build the recorder as the upstream pull request, done well and tested. Inside better-pi-rewind (a second entry), not a package of its own. Retention: removed with the conversation, older than 90 days dropped. (Switch question: not understood — conductor explains; agent tool: not in the first step, recommendation.)
