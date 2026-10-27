---
created: 2026-10-27
updated: 2026-10-27
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-27/start-page-goal-chip
lane: start-goal
lane_seq: 2
preparation: ready
---

# Start page: goal chip in the composer and guide steps in a side panel

## Description

Implements Jari's choice from proto-start-page-goal (A, siru ja paneeli; issues/proto-start-page-goal result.md and prototype are the specification): pressing Aloita puts a goal chip in the composer instead of the raw standard prompt, and the guide's steps stay in a closable side panel during the conversation; on phone the panel does not open by itself and is reachable from the top bar; the sent message shows the chip in history; the goal survives reload through Pi's own skill invocation (the start-page skill writes the long request as a skill, per the result's 1b path).

## Acceptance Criteria

- [ ] Aloita fills the chip, panel shows steps, history shows the chip, reload keeps the goal; desktop and phone; browser tests
