---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: done
priority: normal
provenance: other
provenance_detail: ADR 0038 implementation (technical decision run)
source_ref: taskfleet:01m7ys433k48ngv5prdxv58f4e/adr-0038-implementation:membership
originating_run: 01m7ys433k48ngv5prdxv58f4e
originating_run_kind: technical-decision
preparation: ready
related: ['@multiplayer-conversations']
lane: multiplayer
lane_seq: 2
closed: 2026-11-21
---

# Multiplayer: membership record, invitations, full rights and removal

## Description

Implements section 7 of ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`): the owner's daemon's membership record and the invite, join, Täydet oikeudet and removal operations. Waits for Jari's answers to the ADR's questions.

- A 0600 membership file in the owner's state directory (subject, display name, role `participant`/`full_rights`, state `invited`/`joined`, a generation per grant); the authority for every guest request.
- Owner-session operations through the gateway: invite admitted, bound people (picker lists them by display name and avatar), give or take away Täydet oikeudet, remove. The guest-side `join` route is the only route an invited subject may use.
- Taking away Täydet oikeudet keeps the person a participant and revokes the running grant through the companion (see the Pi turn-mode issue). Removal changes the record, then ends the participant's open guest streams in the daemon, serialised with stream admission, before the gateway deletes its index entry.
- Each change becomes a Habitat line (`oh-conversation-line`) through the companion; if Pi is not running it waits in the record until the next launch.
- Archiving or deleting the conversation ends every membership in it.
- Contract schemas in `contracts/v1/` for membership and shares.

## Resolution

### 2026-11-21T13:27:32Z · @issuectl

Membership record, owner operations, join, take-back and removal landed behind experimental multiplayer; see result.md for decisions and the handoff to guest-routing, guest-stream and turn-modes.
