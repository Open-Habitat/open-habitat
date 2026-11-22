---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-goal-without-guide
lane: start-page-guide
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Start page: a goal can start without opening its guide panel

## Description

Jari (22.11.2026): a start-page goal such as "Pääloop" (prompt
`jatketaan @TODO.md`, `start: immediate`) needs no guide, but choosing a goal
always opens its guide panel beside the conversation, and the start-page
format requires the guide fields (`what`, `when`, `steps`) for every goal.
He wants a goal to be able to start without the guide panel.

Next action (approved for implementation, Jari 22.11.2026): let a start-page
author mark a goal as having no guide, so choosing it opens no guide panel,
and document it in the shipped start-page skill.

## Acceptance Criteria

- [x] An explicit guide-free goal can omit guide fields and prepare or send its request without opening a guide panel.
- [x] Ordinary goals retain their validation and guide behavior.
- [x] The shipped authoring skill documents the option; focused checks and independent review are recorded in result.md.
