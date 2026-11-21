---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: open
priority: normal
provenance: other
provenance_detail: ADR 0038 implementation (technical decision run)
source_ref: taskfleet:01m7ys433k48ngv5prdxv58f4e/adr-0038-implementation:stream
originating_run: 01m7ys433k48ngv5prdxv58f4e
originating_run_kind: technical-decision
preparation: ready
related: ['@multiplayer-conversations']
lane: multiplayer
lane_seq: 5
---

# Multiplayer: participant history read, filtered live stream and controls

## Description

Implements sections 6 and 8 of ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`): what a participant reads and follows live.

- Guest history read of one conversation: blocks with tool names and results, thinking (pending Jari's answer to question 6), participant messages and Habitat lines; no owner-only controls or queue texts; workspace shown by name only; view cards without an open action.
- Guest event stream `GET /guest/v1/conversations/<id>/events` from the owner's journal through an allowlist of this conversation's agent and the permitted kinds (default deny for new kinds). The daemon ends these streams itself when membership ends.
- Daemon facts for the views: each run's mode and who started it, each message's author and role, waiting requests with their approval questions and answers, presence (in memory only).
- Guest routes `send`, `abort` (anyone may stop any turn; it cancels an open approval question), cancel own held message, presence. `stop` and every other control stay owner-only.
- Contract schemas for participant messages, turn modes and waiting requests.
