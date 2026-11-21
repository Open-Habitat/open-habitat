---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: open
priority: normal
provenance: other
provenance_detail: ADR 0038 implementation (technical decision run)
source_ref: taskfleet:01m7ys433k48ngv5prdxv58f4e/adr-0038-implementation:routing
originating_run: 01m7ys433k48ngv5prdxv58f4e
originating_run_kind: technical-decision
preparation: ready
related: ['@multiplayer-conversations']
lane: multiplayer
lane_seq: 3
---

# Multiplayer: guest socket and gateway participation routing

## Description

Implements sections 2 and 7 of ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`): the participant's way in. Waits for Jari's answers to the ADR's questions 1, 4, 5 and 8.

- `open-habitat-guest@.socket` (`/run/open-habitat/users/<name>/guest.sock`, 0660 `<name>:open-habitat-gateway`, `FileDescriptorName=guest`); the broker restores and stops it with the daemon and agent sockets from the committed binding.
- The daemon serves it from a separate default-deny route table that accepts only the gateway's peer UID and the `Open-Habitat-Participant` header (provider subject, display name, avatar; never a Unix name). The header is refused on `daemon.sock`.
- The gateway's participation index (metadata only, next to `view-links.json`) and `/api/v1/shared/<share_id>/...` routing to the fixed guest paths; access needs both the index and the owner's membership record.
- Live relays tied to the share as well as the browser session; a new relay checks the share under the same lock as cancellation.
- Withdrawing a person deletes their index entries as owner and as participant.

Acceptance: a person with no membership, an invited but not joined person, a removed person and a withdrawn-then-readmitted person all get the same refusal; no guest route reaches a workspace, file, terminal, editor, view, setting or another conversation.
