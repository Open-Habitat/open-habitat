---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: open
priority: normal
provenance: other
provenance_detail: ADR 0037 implementation (technical decision run)
source_ref: taskfleet:01m7yk9bnzwbee7v6r48ecfy6e/adr-0037-implementation:browser
originating_run: 01m7yk9bnzwbee7v6r48ecfy6e
originating_run_kind: technical-decision
preparation: ready
related: ['@person-removal-gateway', '@person-removal']
lane: person-removal
lane_seq: 5
---

# Browser: administrator's person removal flow (prototype first)

## Description

# Browser: administrator's person removal flow

Implements the administrator-facing parts of ADR 0037 (`docs/decisions/adr-0037-person-removal.md`): sections 2, 7 and 8. Start with a prototype round for Jari (his 21.11. next action) before building.

- "Poista henkilö" on a person in Settings › Käyttäjät ja pääsy, separate from "Poista pääsy".
- Dialog in the person's terms: access ends and sessions end now, services are disconnected now, shared links stop now, the home (size shown) is deleted for good on the due date; typed GitHub login confirmation; grace period vs immediate removal; a reminder that telling the person and letting them take their data (cancel + restore) is the administrator's job. No workspace, conversation or account names.
- Scheduled state with due date and Cancel; "Poisto kesken" with its reason; "Poistettu" record rows that can be cleared.
- Levytila: "Poistetaan pp.kk." on the row and the sum counting usage instead of the limit.
