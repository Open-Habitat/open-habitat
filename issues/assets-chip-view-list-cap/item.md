---
created: 2026-11-09
updated: 2026-11-09
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: found while fixing assets-chip-misses-views
source_ref: taskfleet:01m6z8dg4bwy3ezdbqtmqwv069/view-list-cap
originating_run: 01m6z8dg4bwy3ezdbqtmqwv069
originating_run_kind: spinoff
---

# Assets chip loses an older conversation's views once the person has over 200 views

## Description

The assets chip takes a conversation's views from `GET /api/v1/views`, the
person's whole view list, which the daemon caps at the newest 200
(`maxViewList`, `contracts/v1/view.schema.json` `list.maxItems`), and
filters it by `conversation_id` in the browser (`ViewHost.tsx` `viewsOf`).
Once a person has more than 200 views, an older conversation's chip lists
only the views whose cards happen to be loaded in its history window
(`noteView`); the rest cannot be reached from the chip.

Observed 2026-11-09 on Birch: Jari's account holds 171 views created since
2026-10-26, so the cap will be reached within days. File offers already
avoid this with `GET /api/v1/file-offers?conversation_id=…`; views need the
same per-conversation read (contract, daemon, gateway forwarding, and the
chip reading it).

Found while fixing `assets-chip-misses-views`, whose actual cause was
folding different reports with the same entry file name.
