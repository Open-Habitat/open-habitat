---
created: 2026-10-27
updated: 2026-10-27
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/wake-stopped-agent
lane: proto-wake
lane_seq: 2
preparation: ready
closed: 2026-10-27
---

# Wake a stopped agent: typing starts it, Habitat's own report card before the wake

## Description

Implements Jari's choice from proto-wake-stopped-agent round 2 (Kortti; issues/proto-wake-stopped-agent/prototypes/wake-2, NOTES.md, result.md is the specification): when a conversation's Pi has stopped, the conversation shows a card written by Habitat (not the agent) saying when and why it stopped (idle, upgrade, crash, stopped by the person) and what settled meanwhile with each run's Taskfleet summary; typing the first character in the composer starts Pi without a turn, sending starts the turn and the agent receives the same report with the message instead of retelling it. No countdown on opening, no automatic wake. Jari approved the needed ADR 0020 change (new idempotent wake operation); record it in the ADR. Host facts: stop time, cause and unreported settlements in the snapshot.

## Acceptance Criteria

- [x] Card shows before any wake for each stop cause; typing wakes once; sending carries the report; tests at the contract and in the browser
