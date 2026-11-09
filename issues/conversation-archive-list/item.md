---
created: 2026-11-09
updated: 2026-11-09
type: improvement
reporter: jari
status: open
priority: normal
lane: archive-proto
lane_seq: 2
preparation: ready
---

# Implement the conversation archive as a dated, searchable list

## Description

Jari accepted direction **1 Lista** of `proto-conversation-archive` round 1
on 9.11.2026; the round (`design-system/prototypes/rounds/2026-11-08-keskustelujen-arkisto/`)
and the issue's `result.md` (host facts, decisions) are the specification.
The workspace page's Arkisto becomes a dated list grouped by archiving time,
newest first, filterable by title; each row opens the conversation read-only
and restores it quietly; archived helpers and workers show as marks on their
conversation's row, not as blocks between rows. No full-text search and no
permanent delete. Ships directly: it replaces a broken view Jari reported.

## Acceptance Criteria

- [ ] The section matches direction 1 for Jari's rows and the prototype's cases, fi and en, 1440 and 390, light and dark; no overlapping buttons.
- [ ] Explain-mode cards for its parts; the coverage check stays green; touched specs green; KOKEILTAVAA line.
