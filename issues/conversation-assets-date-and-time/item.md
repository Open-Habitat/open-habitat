---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-assets-time
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Views and files panel: earlier days show only the date, not the time

## Description

Jari (22.11.2026): in the conversation's "Näkymät ja tiedostot" chip panel,
items from an earlier day show only the date (`time()` in
`web/src/components/ConversationAssets.tsx`: today → hour:minute, otherwise
day.month). A conversation with many offers from yesterday shows a long list
with the same date on every row, so they cannot be told apart.

Next action (approved for implementation, Jari 22.11.2026): show the date
and the time for items not from today (today keeps the time only).

## Acceptance Criteria

- [x] Earlier-day files and views show localized date and time; today's show time only.
- [x] Previous-year rows include the year, and timestamps remain readable on a phone.
- [x] Fixed-clock component regressions and focused browser checks pass (see result.md).
